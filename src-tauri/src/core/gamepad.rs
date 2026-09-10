use gilrs::{EventType, Gilrs};
use serde::Serialize;
use std::{
    panic::{AssertUnwindSafe, catch_unwind},
    sync::{
        Condvar, Mutex, MutexGuard,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Runtime, command};

const EVENT_WAIT: Duration = Duration::from_millis(8);

#[derive(Default)]
struct ListenerState {
    generation: u64,
    requested: bool,
}

impl ListenerState {
    fn request_start(&mut self) -> Option<u64> {
        if self.requested {
            return None;
        }
        self.generation = self.generation.wrapping_add(1);
        self.requested = true;
        Some(self.generation)
    }

    fn request_stop(&mut self) {
        self.requested = false;
        self.generation = self.generation.wrapping_add(1);
    }

    fn accepts(&self, generation: u64) -> bool {
        self.requested && self.generation == generation
    }

    fn fail_if_current(&mut self, generation: u64) -> bool {
        if !self.accepts(generation) {
            return false;
        }
        self.request_stop();
        true
    }
}

struct ListenerControl {
    state: Mutex<ListenerState>,
    changed: Condvar,
    worker_started: AtomicBool,
}

impl ListenerControl {
    const fn new() -> Self {
        Self {
            state: Mutex::new(ListenerState {
                generation: 0,
                requested: false,
            }),
            changed: Condvar::new(),
            worker_started: AtomicBool::new(false),
        }
    }

    fn lock(&self) -> MutexGuard<'_, ListenerState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn claim_worker(&self) -> bool {
        self.worker_started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    }

    fn wait_for_request(&self) -> u64 {
        let mut state = self.lock();
        while !state.requested {
            state = self
                .changed
                .wait(state)
                .unwrap_or_else(|poisoned| poisoned.into_inner());
        }
        state.generation
    }
}

static LISTENER: ListenerControl = ListenerControl::new();

#[derive(Debug, Clone, Serialize)]
pub enum GamepadEventKind {
    ButtonChanged,
    AxisChanged,
}

#[derive(Debug, Clone, Serialize)]
pub struct GamepadEvent {
    kind: GamepadEventKind,
    name: String,
    value: f32,
}

// One worker owns every Gilrs instance in sequence. While stopped it drops the
// native context and parks on a condition variable; mode switches cannot create
// overlapping native readers or leave a previous generation emitting input.
fn listener_worker<R: Runtime>(app_handle: AppHandle<R>) {
    loop {
        let generation = LISTENER.wait_for_request();
        let result = catch_unwind(AssertUnwindSafe(|| {
            listen_generation(&app_handle, generation)
        }))
        .unwrap_or_else(|_| Err("手柄监听发生内部错误，请重新切换到手柄模式重试".into()));
        if let Err(error) = result {
            let mut state = LISTENER.lock();
            if state.fail_if_current(generation) {
                // start returns immediately; asynchronous initialization errors
                // therefore have a separate diagnostic event, without altering
                // the established gamepad-changed event payload.
                let _ = app_handle.emit("gamepad-listener-error", error);
            }
        }
    }
}

fn listen_generation<R: Runtime>(app_handle: &AppHandle<R>, generation: u64) -> Result<(), String> {
    if !LISTENER.lock().accepts(generation) {
        return Ok(());
    }
    let mut gilrs = Gilrs::new().map_err(|error| format!("无法初始化手柄监听：{error}"))?;
    while LISTENER.lock().accepts(generation) {
        let wait_started = Instant::now();
        let event = gilrs.next_event_blocking(Some(EVENT_WAIT));
        let Some(event) = event else {
            // A disconnected backend channel can return None immediately.
            // Retain an idle delay even then, avoiding the original busy loop.
            if let Some(remaining) = EVENT_WAIT.checked_sub(wait_started.elapsed()) {
                std::thread::sleep(remaining);
            }
            continue;
        };
        let gamepad_event = match event.event {
            EventType::ButtonChanged(button, value, ..) => GamepadEvent {
                kind: GamepadEventKind::ButtonChanged,
                name: format!("{button:?}"),
                value,
            },
            EventType::AxisChanged(axis, value, ..) => GamepadEvent {
                kind: GamepadEventKind::AxisChanged,
                name: format!("{axis:?}"),
                value,
            },
            _ => continue,
        };
        // Serialize this final generation check + event queueing with stop.
        // Once stop returns, an obsolete generation cannot publish another event.
        let state = LISTENER.lock();
        if state.accepts(generation) {
            let _ = app_handle.emit("gamepad-changed", gamepad_event);
        }
    }
    Ok(())
}

#[command]
pub async fn start_gamepad_listing<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let mut state = LISTENER.lock();
    let Some(generation) = state.request_start() else {
        return Ok(());
    };
    if LISTENER.claim_worker() {
        // Keep lifecycle changes serialized until spawn either succeeds or rolls
        // back, so a concurrent stop/start cannot lose its worker after a failure.
        if let Err(error) = std::thread::Builder::new()
            .name("gamepad-listener".into())
            .spawn(move || listener_worker(app_handle))
        {
            LISTENER.worker_started.store(false, Ordering::SeqCst);
            state.fail_if_current(generation);
            return Err(format!("手柄监听线程启动失败：{error}"));
        }
    }
    drop(state);
    LISTENER.changed.notify_one();
    Ok(())
}

#[command]
pub async fn stop_gamepad_listing() {
    LISTENER.lock().request_stop();
    LISTENER.changed.notify_one();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier, mpsc};

    #[test]
    fn duplicate_start_keeps_one_generation_and_worker_claim() {
        let control = ListenerControl::new();
        let mut state = control.lock();
        let generation = state.request_start().unwrap();
        assert!(state.request_start().is_none());
        assert!(state.accepts(generation));
        assert!(control.claim_worker());
        assert!(!control.claim_worker());
    }

    #[test]
    fn rapid_stop_start_invalidates_old_events_without_disabling_new_generation() {
        let mut state = ListenerState::default();
        let old = state.request_start().unwrap();
        state.request_stop();
        let current = state.request_start().unwrap();
        assert!(!state.accepts(old));
        assert!(state.accepts(current));
        assert!(!state.fail_if_current(old));
        assert!(state.accepts(current));
        for _ in 0..100 {
            let previous = state.generation;
            state.request_stop();
            let next = state.request_start().unwrap();
            assert_ne!(previous, next);
            assert!(!state.accepts(previous));
            assert!(state.accepts(next));
        }
    }

    #[test]
    fn initialization_failure_allows_retry_and_spawn_failure_releases_cas_claim() {
        let control = ListenerControl::new();
        let mut state = control.lock();
        let failed = state.request_start().unwrap();
        assert!(control.claim_worker());
        assert!(state.fail_if_current(failed));
        assert!(!state.requested);
        let retry = state.request_start().unwrap();
        assert!(state.accepts(retry));
        assert_ne!(failed, retry);
        // A live supervisor remains reusable after Gilrs init failure. Only an
        // actual thread-spawn failure releases the claim for another spawn.
        assert!(!control.claim_worker());
        control.worker_started.store(false, Ordering::SeqCst);
        assert!(control.claim_worker());
    }

    #[test]
    fn stopped_supervisor_parks_until_notified_about_a_new_request() {
        let control = Arc::new(ListenerControl::new());
        let (send, receive) = mpsc::channel();
        let worker_control = control.clone();
        let worker = std::thread::spawn(move || {
            let generation = worker_control.wait_for_request();
            send.send(generation).unwrap();
        });
        assert!(receive.recv_timeout(Duration::from_millis(30)).is_err());
        let generation = control.lock().request_start().unwrap();
        control.changed.notify_one();
        assert_eq!(
            receive.recv_timeout(Duration::from_secs(1)).unwrap(),
            generation
        );
        worker.join().unwrap();
    }

    #[test]
    fn concurrent_worker_claims_have_exactly_one_winner() {
        let control = Arc::new(ListenerControl::new());
        let barrier = Arc::new(Barrier::new(8));
        let workers: Vec<_> = (0..8)
            .map(|_| {
                let control = control.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    control.claim_worker()
                })
            })
            .collect();
        let winners = workers
            .into_iter()
            .map(|worker| worker.join().unwrap() as usize)
            .sum::<usize>();
        assert_eq!(winners, 1);
    }
}
