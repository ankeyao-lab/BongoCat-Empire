use super::growth;
use rdev::EventType;
use serde::Serialize;
use serde_json::{Value, json};
use std::{
    sync::{
        Arc, Mutex, OnceLock,
        atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering},
        mpsc::{self, Receiver, SyncSender},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Runtime, command};

#[derive(Debug, Clone, Serialize)]
pub enum DeviceEventKind {
    MousePress,
    MouseRelease,
    MouseMove,
    PointerScroll,
    KeyboardPress,
    KeyboardRelease,
}
#[derive(Debug, Clone, Serialize)]
pub struct DeviceEvent {
    kind: DeviceEventKind,
    value: Value,
}

/// Process-local aggregates only: no key codes, typed characters or coordinates.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceListenerState {
    phase: String,
    running: bool,
    listening: bool,
    permission_granted: Option<bool>,
    tap_enabled: bool,
    generation: u64,
    recovery_count: u64,
    dropped_events: u64,
    keyboard_events: u64,
    pointer_events: u64,
    scroll_events: u64,
    button_events: u64,
    last_event_at: Option<u64>,
    last_keyboard_event_at: Option<u64>,
    last_pointer_event_at: Option<u64>,
    last_scroll_event_at: Option<u64>,
    checked_at: u64,
    error: Option<String>,
}
impl Default for DeviceListenerState {
    fn default() -> Self {
        Self {
            phase: "stopped".into(),
            running: false,
            listening: false,
            permission_granted: None,
            tap_enabled: false,
            generation: 0,
            recovery_count: 0,
            dropped_events: 0,
            keyboard_events: 0,
            pointer_events: 0,
            scroll_events: 0,
            button_events: 0,
            last_event_at: None,
            last_keyboard_event_at: None,
            last_pointer_event_at: None,
            last_scroll_event_at: None,
            checked_at: now_ms(),
            error: None,
        }
    }
}
#[derive(Default)]
struct Listener {
    running: AtomicBool,
    state: Mutex<DeviceListenerState>,
    generation: AtomicU64,
    recoveries: AtomicU64,
    dropped: AtomicU64,
    keyboard: AtomicU64,
    pointer: AtomicU64,
    scroll: AtomicU64,
    buttons: AtomicU64,
    last_event: AtomicU64,
    last_keyboard: AtomicU64,
    last_pointer: AtomicU64,
    last_scroll: AtomicU64,
    disabled: AtomicU32,
    overflow: AtomicBool,
}
static LISTENER: OnceLock<Arc<Listener>> = OnceLock::new();
fn listener() -> Arc<Listener> {
    LISTENER
        .get_or_init(|| Arc::new(Listener::default()))
        .clone()
}
fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn timestamp(value: &AtomicU64) -> Option<u64> {
    match value.load(Ordering::Relaxed) {
        0 => None,
        n => Some(n),
    }
}
impl Listener {
    fn snapshot(&self) -> DeviceListenerState {
        let mut s = self.state.lock().unwrap_or_else(|p| p.into_inner()).clone();
        s.running = self.running.load(Ordering::SeqCst);
        s.generation = self.generation.load(Ordering::SeqCst);
        s.recovery_count = self.recoveries.load(Ordering::Relaxed);
        s.dropped_events = self.dropped.load(Ordering::Relaxed);
        s.keyboard_events = self.keyboard.load(Ordering::Relaxed);
        s.pointer_events = self.pointer.load(Ordering::Relaxed);
        s.scroll_events = self.scroll.load(Ordering::Relaxed);
        s.button_events = self.buttons.load(Ordering::Relaxed);
        s.last_event_at = timestamp(&self.last_event);
        s.last_keyboard_event_at = timestamp(&self.last_keyboard);
        s.last_pointer_event_at = timestamp(&self.last_pointer);
        s.last_scroll_event_at = timestamp(&self.last_scroll);
        s
    }
    fn status(&self, phase: &str, permission: Option<bool>, enabled: bool, error: Option<String>) {
        let mut s = self.state.lock().unwrap_or_else(|p| p.into_inner());
        if s.phase != phase || s.error != error {
            log::info!(target: "arcana::input", "phase={phase} permission={permission:?} tap_enabled={enabled} generation={} error={error:?}", self.generation.load(Ordering::SeqCst));
        }
        s.phase = phase.into();
        s.permission_granted = permission;
        s.tap_enabled = enabled;
        s.listening = enabled;
        s.error = error;
        s.checked_at = now_ms();
    }
    fn record(&self, event: &EventType) {
        let now = now_ms();
        self.last_event.store(now, Ordering::Relaxed);
        match event {
            EventType::KeyPress(_) | EventType::KeyRelease(_) => {
                self.keyboard.fetch_add(1, Ordering::Relaxed);
                self.last_keyboard.store(now, Ordering::Relaxed);
            }
            EventType::MouseMove { .. } => {
                self.pointer.fetch_add(1, Ordering::Relaxed);
                self.last_pointer.store(now, Ordering::Relaxed);
            }
            EventType::Wheel { .. } => {
                self.scroll.fetch_add(1, Ordering::Relaxed);
                self.last_scroll.store(now, Ordering::Relaxed);
            }
            EventType::ButtonPress(_) | EventType::ButtonRelease(_) => {
                self.buttons.fetch_add(1, Ordering::Relaxed);
            }
        }
    }
}
struct Input {
    generation: u64,
    event: EventType,
}
fn enqueue(shared: &Listener, sender: &SyncSender<Input>, generation: u64, event: EventType) {
    shared.record(&event);
    if sender.try_send(Input { generation, event }).is_err() {
        shared.dropped.fetch_add(1, Ordering::Relaxed);
        shared.overflow.store(true, Ordering::SeqCst);
    }
}
fn device_event(event: &EventType) -> DeviceEvent {
    match event {
        EventType::ButtonPress(b) => DeviceEvent {
            kind: DeviceEventKind::MousePress,
            value: json!(format!("{b:?}")),
        },
        EventType::ButtonRelease(b) => DeviceEvent {
            kind: DeviceEventKind::MouseRelease,
            value: json!(format!("{b:?}")),
        },
        EventType::MouseMove { x, y } => DeviceEvent {
            kind: DeviceEventKind::MouseMove,
            value: json!({ "x": x, "y": y }),
        },
        EventType::Wheel { delta_x, delta_y } => DeviceEvent {
            kind: DeviceEventKind::PointerScroll,
            value: json!({ "x": delta_x, "y": delta_y }),
        },
        EventType::KeyPress(k) => DeviceEvent {
            kind: DeviceEventKind::KeyboardPress,
            value: json!(format!("{k:?}")),
        },
        EventType::KeyRelease(k) => DeviceEvent {
            kind: DeviceEventKind::KeyboardRelease,
            value: json!(format!("{k:?}")),
        },
    }
}
/// Keep all growth, logging and UI work off the event-tap callback and UI run loop.
fn dispatch<R: Runtime>(app: AppHandle<R>, shared: Arc<Listener>, receiver: Receiver<Input>) {
    let mut previous = (false, u64::MAX, None);
    let mut published = Instant::now() - Duration::from_secs(2);
    let mut logged = Instant::now();
    loop {
        let received = receiver.recv_timeout(Duration::from_millis(100));
        let snapshot = shared.snapshot();
        let identity = (
            snapshot.listening,
            snapshot.generation,
            snapshot.error.clone(),
        );
        let changed = identity != previous;
        if changed {
            growth::set_listener_state(&app, snapshot.listening, snapshot.error.clone());
            let _ = app.emit(
                "device-input-reset",
                json!({ "generation": snapshot.generation }),
            );
            previous = identity;
        }
        if changed || published.elapsed() >= Duration::from_secs(1) {
            let _ = app.emit("device-listener-state", &snapshot);
            published = Instant::now();
        }
        if logged.elapsed() >= Duration::from_secs(10) {
            log::info!(target: "arcana::input", "aggregate phase={} keyboard={} pointer={} scroll={} buttons={} dropped={} last_event_at={:?}", snapshot.phase, snapshot.keyboard_events, snapshot.pointer_events, snapshot.scroll_events, snapshot.button_events, snapshot.dropped_events, snapshot.last_event_at);
            logged = Instant::now();
        }
        match received {
            Ok(input) if snapshot.listening && input.generation == snapshot.generation => {
                growth::handle_input(&app, &input.event);
                let _ = app.emit("device-changed", device_event(&input.event));
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
            _ => {}
        }
    }
}
#[command]
pub fn get_device_listener_state() -> DeviceListenerState {
    listener().snapshot()
}
#[command]
pub async fn start_device_listening<R: Runtime>(
    app_handle: AppHandle<R>,
) -> Result<DeviceListenerState, String> {
    let shared = listener();
    if shared
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(shared.snapshot());
    }
    shared.status("starting", None, false, None);
    let (sender, receiver) = mpsc::sync_channel(1024);
    let dispatch_shared = shared.clone();
    if let Err(error) = std::thread::Builder::new()
        .name("input-dispatch".into())
        .spawn(move || dispatch(app_handle, dispatch_shared, receiver))
    {
        shared.running.store(false, Ordering::SeqCst);
        let message = format!("输入分发线程启动失败：{error}");
        shared.status("error", None, false, Some(message.clone()));
        return Err(message);
    }
    let worker = shared.clone();
    if let Err(error) = std::thread::Builder::new()
        .name("device-listener".into())
        .spawn(move || {
            #[cfg(target_os = "macos")]
            macos::supervise(&worker, &sender);
            #[cfg(not(target_os = "macos"))]
            {
                let generation = worker.generation.fetch_add(1, Ordering::SeqCst) + 1;
                let callback_worker = worker.clone();
                let result = rdev::listen(move |event| {
                    callback_worker.status("listening", None, true, None);
                    enqueue(&callback_worker, &sender, generation, event.event_type);
                });
                worker.status(
                    "error",
                    None,
                    false,
                    Some(format!("输入监听已结束：{result:?}")),
                );
            }
            worker.running.store(false, Ordering::SeqCst);
        })
    {
        shared.running.store(false, Ordering::SeqCst);
        let message = format!("输入监听线程启动失败：{error}");
        shared.status("error", None, false, Some(message.clone()));
        return Err(message);
    }
    Ok(shared.snapshot())
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use rdev::{Button, Key};
    use std::{ffi::c_void, ptr};
    // C ABI matches Apple's SDK; a raw u32 accepts disabled notifications safely.
    type Ref = *mut c_void;
    type Callback = unsafe extern "C" fn(Ref, u32, Ref, Ref) -> Ref;
    #[repr(C)]
    struct Point {
        x: f64,
        y: f64,
    }
    #[link(name = "CoreGraphics", kind = "framework")]
    unsafe extern "C" {
        fn CGPreflightListenEventAccess() -> bool;
        fn CGEventTapCreate(
            location: u32,
            placement: u32,
            options: u32,
            mask: u64,
            callback: Callback,
            info: Ref,
        ) -> Ref;
        fn CGEventTapEnable(tap: Ref, enabled: bool);
        fn CGEventTapIsEnabled(tap: Ref) -> bool;
        fn CGEventGetIntegerValueField(event: Ref, field: u32) -> i64;
        fn CGEventGetDoubleValueField(event: Ref, field: u32) -> f64;
        fn CGEventGetFlags(event: Ref) -> u64;
        fn CGEventGetLocation(event: Ref) -> Point;
        fn CGEventSourceKeyState(source: i32, key: u16) -> bool;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFMachPortCreateRunLoopSource(allocator: Ref, port: Ref, order: isize) -> Ref;
        fn CFMachPortInvalidate(port: Ref);
        fn CFMachPortIsValid(port: Ref) -> bool;
        fn CFRunLoopGetCurrent() -> Ref;
        fn CFRunLoopAddSource(run_loop: Ref, source: Ref, mode: Ref);
        fn CFRunLoopRemoveSource(run_loop: Ref, source: Ref, mode: Ref);
        fn CFRunLoopSourceInvalidate(source: Ref);
        fn CFRunLoopRunInMode(mode: Ref, seconds: f64, return_after_source: bool) -> i32;
        fn CFRelease(object: Ref);
        static kCFRunLoopDefaultMode: Ref;
    }
    const TIMEOUT: u32 = 0xFFFF_FFFE;
    const USER_DISABLED: u32 = 0xFFFF_FFFF;
    const TYPES: [u32; 14] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 22, 25, 26, 27];
    struct Context<'a> {
        shared: &'a Listener,
        sender: &'a SyncSender<Input>,
        generation: u64,
    }
    fn modifier_pressed(code: u16, flags: u64, physical_down: bool) -> bool {
        match code {
            57 => flags & (1 << 16) != 0,
            63 => flags & (1 << 23) != 0,
            _ => physical_down,
        }
    }
    fn scroll_delta(point: f64, line: i64) -> i64 {
        if point.is_finite() && point != 0.0 {
            let rounded = point.round() as i64;
            if rounded == 0 {
                if point < 0.0 { -1 } else { 1 }
            } else {
                rounded
            }
        } else {
            line
        }
    }
    unsafe extern "C" fn callback(_proxy: Ref, kind: u32, event: Ref, info: Ref) -> Ref {
        let context = unsafe { &*(info as *const Context<'_>) };
        if kind == TIMEOUT || kind == USER_DISABLED {
            context.shared.disabled.store(kind, Ordering::SeqCst);
            return event;
        }
        if event.is_null() {
            return event;
        }
        let converted = match kind {
            1 => Some(EventType::ButtonPress(Button::Left)),
            2 => Some(EventType::ButtonRelease(Button::Left)),
            3 => Some(EventType::ButtonPress(Button::Right)),
            4 => Some(EventType::ButtonRelease(Button::Right)),
            25 | 26 => {
                let number = unsafe { CGEventGetIntegerValueField(event, 3) };
                let button = if number == 2 {
                    Button::Middle
                } else {
                    Button::Unknown(number as u8)
                };
                Some(if kind == 25 {
                    EventType::ButtonPress(button)
                } else {
                    EventType::ButtonRelease(button)
                })
            }
            5 | 6 | 7 | 27 => {
                let p = unsafe { CGEventGetLocation(event) };
                Some(EventType::MouseMove { x: p.x, y: p.y })
            }
            10..=12 => {
                let code = unsafe { CGEventGetIntegerValueField(event, 9) } as u16;
                let key: Key = rdev::macos_key_from_code(code);
                let pressed = match kind {
                    10 => true,
                    11 => false,
                    _ => modifier_pressed(code, unsafe { CGEventGetFlags(event) }, unsafe {
                        CGEventSourceKeyState(1, code)
                    }),
                };
                Some(if pressed {
                    EventType::KeyPress(key)
                } else {
                    EventType::KeyRelease(key)
                })
            }
            22 => Some(EventType::Wheel {
                delta_x: scroll_delta(unsafe { CGEventGetDoubleValueField(event, 97) }, unsafe {
                    CGEventGetIntegerValueField(event, 12)
                }),
                delta_y: scroll_delta(unsafe { CGEventGetDoubleValueField(event, 96) }, unsafe {
                    CGEventGetIntegerValueField(event, 11)
                }),
            }),
            _ => None,
        };
        if let Some(event) = converted {
            enqueue(context.shared, context.sender, context.generation, event);
        }
        event
    }
    struct Tap {
        port: Ref,
        source: Ref,
        run_loop: Ref,
    }
    impl Drop for Tap {
        fn drop(&mut self) {
            unsafe {
                CGEventTapEnable(self.port, false);
                if !self.source.is_null() {
                    CFRunLoopRemoveSource(self.run_loop, self.source, kCFRunLoopDefaultMode);
                    CFRunLoopSourceInvalidate(self.source);
                    CFRelease(self.source);
                }
                CFMachPortInvalidate(self.port);
                CFRelease(self.port);
            }
        }
    }
    fn run_tap(shared: &Listener, sender: &SyncSender<Input>) -> Result<(), String> {
        shared.disabled.store(0, Ordering::SeqCst);
        shared.overflow.store(false, Ordering::SeqCst);
        let generation = shared.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let mut context = Context {
            shared,
            sender,
            generation,
        };
        // Session + ListenOnly observes keyboard/pointer without filtering events.
        let port = unsafe {
            CGEventTapCreate(
                1,
                0,
                1,
                TYPES.iter().fold(0, |m, n| m | (1_u64 << n)),
                callback,
                &mut context as *mut _ as Ref,
            )
        };
        if port.is_null() {
            return Err("输入权限已开启，但系统拒绝创建会话监听器；正在自动重试".into());
        }
        // Source/tap drop BEFORE Context, preventing callbacks into expired state.
        let mut tap = Tap {
            port,
            source: ptr::null_mut(),
            run_loop: unsafe { CFRunLoopGetCurrent() },
        };
        tap.source = unsafe { CFMachPortCreateRunLoopSource(ptr::null_mut(), port, 0) };
        if tap.source.is_null() {
            return Err("输入监听器的运行循环创建失败；正在自动重试".into());
        }
        unsafe {
            CFRunLoopAddSource(tap.run_loop, tap.source, kCFRunLoopDefaultMode);
            CGEventTapEnable(port, true);
        }
        if !unsafe { CGEventTapIsEnabled(port) } {
            return Err("系统输入监听器尚未启用；正在自动重试".into());
        }
        shared.status("listening", Some(true), true, None);
        let mut checked = Instant::now();
        loop {
            let result = unsafe { CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.1, true) };
            let disabled = shared.disabled.swap(0, Ordering::SeqCst);
            if disabled != 0 {
                return Err(if disabled == TIMEOUT {
                    "系统因超时停用了输入监听器，正在重建"
                } else {
                    "系统停用了输入监听器，正在重新检查权限并重建"
                }
                .into());
            }
            if shared.overflow.swap(false, Ordering::SeqCst) {
                return Err("输入分发暂时拥塞，正在清理按下状态并重建监听".into());
            }
            if result == 1 || result == 2 {
                return Err("输入监听运行循环已停止，正在重建".into());
            }
            if checked.elapsed() >= Duration::from_secs(1) {
                if !unsafe { CGPreflightListenEventAccess() } {
                    return Err("输入监控权限尚未生效或已撤销；授权生效后会自动恢复".into());
                }
                if !unsafe { CFMachPortIsValid(port) && CGEventTapIsEnabled(port) } {
                    return Err("检测到输入监听器已失效，正在重建".into());
                }
                shared.status("listening", Some(true), true, None);
                checked = Instant::now();
            }
        }
    }
    pub(super) fn supervise(shared: &Listener, sender: &SyncSender<Input>) {
        loop {
            let permission = unsafe { CGPreflightListenEventAccess() };
            if !permission {
                shared.status(
                    "permissionDenied",
                    Some(false),
                    false,
                    Some(
                        "输入监控权限尚未对当前版本生效；若系统开关已开启，请在通用设置查看重新登记方法"
                            .into(),
                    ),
                );
                std::thread::sleep(Duration::from_secs(2));
                continue;
            }
            if let Err(error) = run_tap(shared, sender) {
                shared.recoveries.fetch_add(1, Ordering::Relaxed);
                let permission = unsafe { CGPreflightListenEventAccess() };
                shared.status("recovering", Some(permission), false, Some(error));
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn physical_key_mapping_remains_compatible() {
            for (code, key) in [
                (0, Key::KeyA),
                (38, Key::KeyJ),
                (36, Key::Return),
                (49, Key::Space),
                (51, Key::Backspace),
                (123, Key::LeftArrow),
            ] {
                assert_eq!(rdev::macos_key_from_code(code), key);
            }
        }
        #[test]
        fn overlapping_modifiers_use_physical_key_not_flag_order() {
            assert!(modifier_pressed(56, 1 << 17, true));
            assert!(modifier_pressed(60, 1 << 17, true));
            assert!(!modifier_pressed(56, 1 << 17, false));
            assert!(modifier_pressed(57, 1 << 16, false));
            assert!(modifier_pressed(63, 1 << 23, false));
        }
        #[test]
        fn fine_trackpad_and_line_mouse_scroll_are_not_lost() {
            assert_eq!(scroll_delta(0.2, 0), 1);
            assert_eq!(scroll_delta(-0.2, 0), -1);
            assert_eq!(scroll_delta(0.0, -3), -3);
        }
        #[test]
        fn disabled_notification_does_not_dereference_null_event() {
            let shared = Listener::default();
            let (sender, _) = mpsc::sync_channel(1);
            let mut context = Context {
                shared: &shared,
                sender: &sender,
                generation: 1,
            };
            assert!(
                unsafe {
                    callback(
                        ptr::null_mut(),
                        TIMEOUT,
                        ptr::null_mut(),
                        &mut context as *mut _ as Ref,
                    )
                }
                .is_null()
            );
            assert_eq!(shared.disabled.load(Ordering::SeqCst), TIMEOUT);
            assert_eq!(shared.keyboard.load(Ordering::Relaxed), 0);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn overflow_signals_reset_and_preserves_generation() {
        let shared = Listener::default();
        let (sender, receiver) = mpsc::sync_channel(1);
        enqueue(&shared, &sender, 7, EventType::KeyPress(rdev::Key::KeyA));
        enqueue(&shared, &sender, 7, EventType::KeyRelease(rdev::Key::KeyA));
        assert_eq!(receiver.recv().unwrap().generation, 7);
        assert_eq!(shared.snapshot().keyboard_events, 2);
        assert_eq!(shared.snapshot().dropped_events, 1);
        assert!(shared.overflow.load(Ordering::SeqCst));
    }
    #[test]
    fn diagnostics_are_aggregate_only_and_not_ready_before_tap() {
        let shared = Listener::default();
        shared.record(&EventType::KeyPress(rdev::Key::KeyA));
        shared.record(&EventType::MouseMove { x: 123.0, y: 456.0 });
        let json = serde_json::to_value(shared.snapshot()).unwrap();
        assert_eq!(json["keyboardEvents"], 1);
        assert_eq!(json["pointerEvents"], 1);
        for private in ["key", "value", "x", "y", "text", "unicode"] {
            assert!(json.get(private).is_none());
        }
        assert!(!json["listening"].as_bool().unwrap());
    }
}
