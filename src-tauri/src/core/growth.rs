//! Local, aggregate-only progression. Key identifiers stay in transient input/held-key memory.
use rdev::EventType;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex, MutexGuard,
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc::{self, SyncSender},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, Runtime, State, command};

const SCHEMA_VERSION: u32 = 4;
const THEME_IDS: [&str; 12] = [
    "wizard",
    "astronaut",
    "pirate",
    "ninja",
    "hero",
    "wuxia",
    "baker",
    "garden",
    "performer",
    "cultivation",
    "shaolin",
    "emperor",
];
fn default_true() -> bool {
    true
}
fn default_themes() -> BTreeMap<String, ThemeProgress> {
    THEME_IDS
        .into_iter()
        .map(|id| (id.into(), ThemeProgress::default()))
        .collect()
}
const WIZARD_THEME: &str = "wizard";
const RULE_VERSION: u32 = 1;
const MAX_SAFE_COUNT: u64 = 9_007_199_254_740_991;
const LEGACY_THRESHOLDS: [u64; 9] = [
    0, 2_000, 8_000, 20_000, 45_000, 85_000, 140_000, 220_000, 320_000,
];
const DEFAULT_DAILY_PRESS_BUDGET: u64 = 5_000;
const DEFAULT_ACTIVE_DAYS_PER_WEEK: u8 = 5;
const MAX_DAILY_PRESS_BUDGET: u64 = MAX_SAFE_COUNT / 7;
const THRESHOLDS: [u64; 9] = [0, 750, 2_500, 5_000, 8_750, 12_500, 16_250, 20_500, 25_000];
const WEEKLY_PERCENTAGES: [u64; 9] = [0, 3, 10, 20, 35, 50, 65, 82, 100];
const SAVE_INTERVAL: Duration = Duration::from_secs(10);
const SNAPSHOT_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum ThresholdMode {
    Weekly,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ThemeProgress {
    presses: u64,
    thresholds: [u64; 9],
    threshold_mode: ThresholdMode,
    round_presses: u64,
    round_level: u8,
    unlocked_level: u8,
    equipped_level: u8,
}

impl Default for ThemeProgress {
    fn default() -> Self {
        Self {
            presses: 0,
            thresholds: THRESHOLDS,
            threshold_mode: ThresholdMode::Weekly,
            round_presses: 0,
            round_level: 1,
            unlocked_level: 1,
            equipped_level: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Progress {
    schema_version: u32,
    rule_version: u32,
    total_presses: u64,
    daily_press_budget: u64,
    active_days_per_week: u8,
    auto_cycle: bool,
    cycle_round: u64,
    growth_theme_id: String,
    outfit_theme_id: String,
    themes: BTreeMap<String, ThemeProgress>,
    paused: bool,
    auto_equip: bool,
    reduced_motion: bool,
    show_progress: bool,
    quiet_mode: bool,
    #[serde(default = "default_true")]
    decorations_enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyProgress {
    schema_version: u32,
    rule_version: u32,
    total_presses: u64,
    theme_presses: u64,
    equipped_level: u8,
    paused: bool,
    auto_equip: bool,
    reduced_motion: bool,
    show_progress: bool,
    quiet_mode: bool,
}

// Deserialize older layouts separately: missing schema4 fields must never silently
// reset a current save, and historical levels are validated against the old rules.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyThemeProgress {
    presses: u64,
    thresholds: [u64; 9],
    unlocked_level: u8,
    equipped_level: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LegacyMultiProgress {
    schema_version: u32,
    rule_version: u32,
    total_presses: u64,
    growth_theme_id: String,
    outfit_theme_id: String,
    themes: BTreeMap<String, LegacyThemeProgress>,
    paused: bool,
    auto_equip: bool,
    reduced_motion: bool,
    show_progress: bool,
    quiet_mode: bool,
    #[serde(default = "default_true")]
    decorations_enabled: bool,
}

impl Default for Progress {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            rule_version: RULE_VERSION,
            total_presses: 0,
            daily_press_budget: DEFAULT_DAILY_PRESS_BUDGET,
            active_days_per_week: DEFAULT_ACTIVE_DAYS_PER_WEEK,
            auto_cycle: true,
            cycle_round: 1,
            growth_theme_id: WIZARD_THEME.into(),
            outfit_theme_id: WIZARD_THEME.into(),
            themes: default_themes(),
            paused: false,
            auto_equip: true,
            reduced_motion: true,
            show_progress: true,
            quiet_mode: false,
            decorations_enabled: true,
        }
    }
}

fn level_for_thresholds(presses: u64, thresholds: &[u64; 9]) -> u8 {
    thresholds
        .iter()
        .filter(|&&threshold| presses >= threshold)
        .count() as u8
}

fn validate_thresholds(thresholds: &[u64; 9]) -> Result<(), String> {
    if thresholds[0] != 0
        || thresholds.iter().any(|value| *value > MAX_SAFE_COUNT)
        || thresholds.windows(2).any(|pair| pair[0] >= pair[1])
    {
        return Err("升级门槛必须为9个安全范围内的非负整数，首项为0且严格递增".into());
    }
    Ok(())
}

fn weekly_thresholds(daily_budget: u64, active_days: u8) -> Result<[u64; 9], String> {
    if !(1..=MAX_DAILY_PRESS_BUDGET).contains(&daily_budget) || !(1..=7).contains(&active_days) {
        return Err("每日按键预算必须为安全范围内的正整数，每周活跃天数必须为1至7天".into());
    }
    let target = daily_budget * u64::from(active_days);
    if target < 8 {
        return Err("每周目标至少需要8次有效按键，才能分配9个递增等级".into());
    }
    let mut thresholds = [0_u64; 9];
    for index in 1..9 {
        let rounded =
            ((u128::from(target) * u128::from(WEEKLY_PERCENTAGES[index]) + 50) / 100) as u64;
        thresholds[index] =
            (thresholds[index - 1] + 1).max(rounded.min(target - (8 - index) as u64));
    }
    Ok(thresholds)
}

impl Progress {
    fn active(&self) -> &ThemeProgress {
        self.themes
            .get(&self.growth_theme_id)
            .expect("validated active growth theme")
    }

    fn active_mut(&mut self) -> &mut ThemeProgress {
        self.themes
            .get_mut(&self.growth_theme_id)
            .expect("validated active growth theme")
    }

    // Called only on a candidate that will be atomically saved before publication.
    // Collection levels are permanent; only this round determines the next theme.
    fn advance_cycle(&mut self) {
        if !self.auto_cycle || self.paused || self.active().round_level < 9 {
            return;
        }
        let current = THEME_IDS
            .iter()
            .position(|id| *id == self.growth_theme_id)
            .unwrap();
        let next = (1..=THEME_IDS.len())
            .map(|offset| THEME_IDS[(current + offset) % THEME_IDS.len()])
            .find(|id| self.themes[*id].round_level < 9);
        let next = match next {
            Some(id) => id,
            None if self.cycle_round < MAX_SAFE_COUNT => {
                self.cycle_round += 1;
                for theme in self.themes.values_mut() {
                    theme.round_presses = 0;
                    theme.round_level = 1;
                }
                THEME_IDS[0]
            }
            None => return, // Never overflow the persisted, JS-safe round counter.
        };
        self.growth_theme_id = next.into();
        self.outfit_theme_id = next.into();
        let theme = self.themes.get_mut(next).unwrap();
        theme.equipped_level = theme.round_level;
    }

    fn validate(&self) -> Result<(), String> {
        if self.schema_version != SCHEMA_VERSION || self.rule_version != RULE_VERSION {
            return Err("不支持的存档或成长规则版本，请使用本版本导出的存档".into());
        }
        let weekly = weekly_thresholds(self.daily_press_budget, self.active_days_per_week)?;
        if !(1..=MAX_SAFE_COUNT).contains(&self.cycle_round) {
            return Err("存档轮次超出安全整数范围".into());
        }
        if !THEME_IDS.contains(&self.growth_theme_id.as_str())
            || (self.outfit_theme_id != "none"
                && !THEME_IDS.contains(&self.outfit_theme_id.as_str()))
            || self.themes.len() != THEME_IDS.len()
            || THEME_IDS.iter().any(|id| !self.themes.contains_key(*id))
        {
            return Err("存档含无效主题或缺少主题记录".into());
        }
        if self.total_presses > MAX_SAFE_COUNT {
            return Err("存档总计数超出安全整数范围".into());
        }
        let mut attributed_presses = 0_u64;
        for theme in self.themes.values() {
            validate_thresholds(&theme.thresholds)?;
            if theme.threshold_mode == ThresholdMode::Weekly && theme.thresholds != weekly {
                return Err("每周节奏主题的门槛与当前预算不一致".into());
            }
            attributed_presses = attributed_presses
                .checked_add(theme.presses)
                .ok_or("主题累计计数溢出")?;
            if theme.round_presses > theme.presses
                || !(1..=9).contains(&theme.round_level)
                || theme.round_level < level_for_thresholds(theme.round_presses, &theme.thresholds)
                || !(theme.round_level..=9).contains(&theme.unlocked_level)
                || !(1..=theme.unlocked_level).contains(&theme.equipped_level)
            {
                return Err("存档本轮进度、解锁或穿戴等级无效".into());
            }
        }
        if attributed_presses > self.total_presses {
            return Err("各主题累计计数之和不得超过总计数".into());
        }
        Ok(())
    }

    fn migrate_theme(legacy: LegacyThemeProgress) -> Result<ThemeProgress, String> {
        validate_thresholds(&legacy.thresholds)?;
        if !(1..=9).contains(&legacy.unlocked_level)
            || legacy.unlocked_level < level_for_thresholds(legacy.presses, &legacy.thresholds)
            || !(1..=legacy.unlocked_level).contains(&legacy.equipped_level)
        {
            return Err("旧版存档解锁或穿戴等级无效".into());
        }
        let (thresholds, threshold_mode) = if legacy.thresholds == LEGACY_THRESHOLDS {
            (THRESHOLDS, ThresholdMode::Weekly)
        } else {
            (legacy.thresholds, ThresholdMode::Custom)
        };
        let level = legacy
            .unlocked_level
            .max(level_for_thresholds(legacy.presses, &thresholds));
        Ok(ThemeProgress {
            presses: legacy.presses,
            thresholds,
            threshold_mode,
            round_presses: legacy.presses,
            round_level: level,
            unlocked_level: level,
            // Migration preserves the outfit the user actually selected.
            equipped_level: legacy.equipped_level,
        })
    }

    fn parse(json: &str) -> Result<Self, String> {
        if json.len() > 64 * 1024 {
            return Err("存档文件过大".into());
        }
        let value: serde_json::Value =
            serde_json::from_str(json).map_err(|error| format!("存档 JSON 无效：{error}"))?;
        let mut progress = match value
            .get("schemaVersion")
            .and_then(|version| version.as_u64())
        {
            Some(1) => {
                let legacy: LegacyProgress = serde_json::from_value(value)
                    .map_err(|error| format!("旧版存档无效：{error}"))?;
                let old_level = level_for_thresholds(legacy.theme_presses, &LEGACY_THRESHOLDS);
                if legacy.schema_version != 1
                    || legacy.rule_version != RULE_VERSION
                    || legacy.total_presses > MAX_SAFE_COUNT
                    || legacy.theme_presses > legacy.total_presses
                    || !(1..=old_level).contains(&legacy.equipped_level)
                {
                    return Err("旧版存档的版本、计数或穿戴等级无效".into());
                }
                let mut next = Self {
                    total_presses: legacy.total_presses,
                    paused: legacy.paused,
                    auto_equip: legacy.auto_equip,
                    reduced_motion: legacy.reduced_motion,
                    show_progress: legacy.show_progress,
                    quiet_mode: legacy.quiet_mode,
                    ..Self::default()
                };
                next.themes.insert(
                    WIZARD_THEME.into(),
                    Self::migrate_theme(LegacyThemeProgress {
                        presses: legacy.theme_presses,
                        thresholds: LEGACY_THRESHOLDS,
                        unlocked_level: old_level,
                        equipped_level: legacy.equipped_level,
                    })?,
                );
                next
            }
            Some(2 | 3) => {
                let legacy: LegacyMultiProgress = serde_json::from_value(value)
                    .map_err(|error| format!("旧版存档无效：{error}"))?;
                if legacy.rule_version != RULE_VERSION
                    || legacy
                        .themes
                        .keys()
                        .any(|id| !THEME_IDS.contains(&id.as_str()))
                    || (legacy.schema_version == 2 && !legacy.themes.contains_key(WIZARD_THEME))
                    || (legacy.schema_version == 3 && legacy.themes.len() != THEME_IDS.len())
                {
                    return Err("旧版存档含无效规则、未知主题或缺少主题记录".into());
                }
                let mut next = Self {
                    total_presses: legacy.total_presses,
                    growth_theme_id: legacy.growth_theme_id,
                    outfit_theme_id: legacy.outfit_theme_id,
                    paused: legacy.paused,
                    auto_equip: legacy.auto_equip,
                    reduced_motion: legacy.reduced_motion,
                    show_progress: legacy.show_progress,
                    quiet_mode: legacy.quiet_mode,
                    decorations_enabled: legacy.decorations_enabled,
                    ..Self::default()
                };
                for (id, theme) in legacy.themes {
                    next.themes.insert(id, Self::migrate_theme(theme)?);
                }
                next
            }
            Some(version) if version == SCHEMA_VERSION as u64 => {
                serde_json::from_value(value).map_err(|error| format!("存档 JSON 无效：{error}"))?
            }
            _ => return Err("不支持的存档版本".into()),
        };
        progress.schema_version = SCHEMA_VERSION;
        progress.validate()?;
        Ok(progress)
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrowthSnapshot {
    schema_version: u32,
    rule_version: u32,
    total_presses: u64,
    daily_press_budget: u64,
    active_days_per_week: u8,
    weekly_target_presses: u64,
    auto_cycle: bool,
    cycle_round: u64,
    round_presses: u64,
    round_level: u8,
    growth_theme_id: String,
    outfit_theme_id: String,
    themes: BTreeMap<String, ThemeProgress>,
    thresholds: [u64; 9],
    theme_presses: u64,
    level: u8,
    equipped_level: u8,
    unlocked_levels: Vec<u8>,
    paused: bool,
    auto_equip: bool,
    reduced_motion: bool,
    show_progress: bool,
    quiet_mode: bool,
    decorations_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    save_error: Option<String>,
    listening: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    listener_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_saved_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UnlockedEvent {
    theme_id: String,
    levels: Vec<u8>,
    equipped_level: u8,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GrowthSettings {
    auto_cycle: Option<bool>,
    paused: Option<bool>,
    auto_equip: Option<bool>,
    reduced_motion: Option<bool>,
    show_progress: Option<bool>,
    quiet_mode: Option<bool>,
    decorations_enabled: Option<bool>,
}

struct GrowthInner {
    progress: Progress,
    directory: PathBuf,
    held_keys: HashSet<String>,
    dirty: bool,
    notify_pending: bool,
    save_requested: bool,
    pending_unlocks: BTreeMap<String, Vec<u8>>,
    last_save_attempt: Instant,
    last_emit: Instant,
    save_error: Option<String>,
    save_blocked: bool,
    listening: bool,
    listener_error: Option<String>,
    last_saved_at: Option<u64>,
}

impl GrowthInner {
    fn load(directory: PathBuf) -> Self {
        let primary = directory.join("growth.json");
        let backup = directory.join("growth.backup.json");
        let incompatible_primary = has_unsupported_version(&primary);
        let migrating = matches!(disk_schema_version(&primary), Some(1 | 2 | 3));
        let (progress, save_error, recovered, save_blocked) = match read_progress(&primary) {
            Ok(progress) => (progress, None, false, false),
            Err(primary_error) => match read_progress(&backup) {
                Ok(progress) => (
                    progress,
                    Some(if incompatible_primary {
                        format!(
                            "主存档版本不兼容，已保护原文件并暂停保存；当前显示备份进度，请导入有效存档或明确重置：{primary_error}"
                        )
                    } else {
                        format!("主存档读取失败，已恢复备份：{primary_error}")
                    }),
                    true,
                    incompatible_primary,
                ),
                Err(backup_error) if is_missing(&primary) && is_missing(&backup) => {
                    let _ = backup_error;
                    (Progress::default(), None, false, false)
                }
                Err(backup_error) => (
                    Progress::default(),
                    Some(format!(
                        "存档无法读取，已保护原文件并暂停保存；请导入有效备份或明确重置进度。主档：{primary_error}；备份：{backup_error}"
                    )),
                    false,
                    true,
                ),
            },
        };
        let last_saved_at = fs::metadata(if recovered { &backup } else { &primary })
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64);
        Self {
            progress,
            directory,
            held_keys: HashSet::new(),
            dirty: recovered || migrating,
            notify_pending: false,
            save_requested: migrating,
            pending_unlocks: BTreeMap::new(),
            last_save_attempt: Instant::now(),
            last_emit: Instant::now(),
            save_error,
            save_blocked,
            listening: false,
            listener_error: None,
            last_saved_at,
        }
    }

    fn snapshot(&self) -> GrowthSnapshot {
        let progress = &self.progress;
        let active = progress.active();
        let level = active.unlocked_level;
        GrowthSnapshot {
            schema_version: progress.schema_version,
            rule_version: progress.rule_version,
            total_presses: progress.total_presses,
            daily_press_budget: progress.daily_press_budget,
            active_days_per_week: progress.active_days_per_week,
            weekly_target_presses: progress.daily_press_budget
                * u64::from(progress.active_days_per_week),
            auto_cycle: progress.auto_cycle,
            cycle_round: progress.cycle_round,
            round_presses: active.round_presses,
            round_level: active.round_level,
            growth_theme_id: progress.growth_theme_id.clone(),
            outfit_theme_id: progress.outfit_theme_id.clone(),
            themes: progress.themes.clone(),
            thresholds: active.thresholds,
            theme_presses: active.presses,
            level,
            equipped_level: active.equipped_level,
            unlocked_levels: (1..=level).collect(),
            paused: progress.paused,
            auto_equip: progress.auto_equip,
            reduced_motion: progress.reduced_motion,
            show_progress: progress.show_progress,
            quiet_mode: progress.quiet_mode,
            decorations_enabled: progress.decorations_enabled,
            save_error: self.save_error.clone(),
            listening: self.listening,
            listener_error: self.listener_error.clone(),
            last_saved_at: self.last_saved_at,
        }
    }

    fn take_snapshot(&mut self) -> GrowthSnapshot {
        self.last_emit = Instant::now();
        self.notify_pending = false;
        self.snapshot()
    }

    fn handle_timer_gap(&mut self, elapsed: Option<Duration>) {
        if elapsed.is_none_or(|gap| gap > Duration::from_secs(3)) {
            self.held_keys.clear();
        }
    }

    #[cfg(test)]
    fn process_key(&mut self, key: &str, pressed: bool) -> Vec<u8> {
        let theme_id = self.progress.growth_theme_id.clone();
        self.process_key_for_theme(&theme_id, key, pressed)
    }

    fn process_key_for_theme(&mut self, theme_id: &str, key: &str, pressed: bool) -> Vec<u8> {
        self.process_key_for_route(theme_id, self.progress.cycle_round, key, pressed)
    }

    fn process_key_for_route(
        &mut self,
        theme_id: &str,
        cycle_round: u64,
        key: &str,
        pressed: bool,
    ) -> Vec<u8> {
        if !pressed {
            self.held_keys.remove(key);
            return Vec::new();
        }
        if self.progress.paused || is_modifier(key) || !self.held_keys.insert(key.to_owned()) {
            return Vec::new();
        }
        if self.progress.total_presses == MAX_SAFE_COUNT {
            return Vec::new();
        }
        let theme = self
            .progress
            .themes
            .get_mut(theme_id)
            .expect("validated queued theme");
        let previous_level = theme.unlocked_level;
        let previous_round_level = theme.round_level;
        self.progress.total_presses += 1;
        theme.presses += 1;
        self.dirty = true;
        self.notify_pending = true;
        // Events queued during a new-round disk commit retain their historical
        // owner, but must not become fresh XP in the newly opened round.
        if cycle_round != self.progress.cycle_round {
            return Vec::new();
        }
        theme.round_presses += 1;
        theme.round_level = theme
            .round_level
            .max(level_for_thresholds(theme.round_presses, &theme.thresholds));
        theme.unlocked_level = theme.unlocked_level.max(theme.round_level);
        if theme.round_level > previous_round_level {
            if self.progress.auto_equip {
                theme.equipped_level = theme.round_level;
            }
            self.save_requested = true;
        }
        if theme_id == self.progress.growth_theme_id
            && theme.round_level == 9
            && self.progress.auto_cycle
        {
            self.save_requested = true;
        }
        if theme.unlocked_level > previous_level {
            let levels: Vec<u8> = ((previous_level + 1)..=theme.unlocked_level).collect();
            self.pending_unlocks
                .entry(theme_id.into())
                .or_default()
                .extend(levels.iter().copied());
            return levels;
        }
        Vec::new()
    }

    fn update_settings(&mut self, settings: GrowthSettings) {
        if let Some(auto_cycle) = settings.auto_cycle {
            self.progress.auto_cycle = auto_cycle;
        }
        if let Some(paused) = settings.paused {
            self.progress.paused = paused;
            self.held_keys.clear();
        }
        if let Some(auto_equip) = settings.auto_equip {
            self.progress.auto_equip = auto_equip;
            if auto_equip {
                self.progress.active_mut().equipped_level = self.progress.active().round_level;
            }
        }
        if let Some(value) = settings.reduced_motion {
            self.progress.reduced_motion = value;
        }
        if let Some(value) = settings.show_progress {
            self.progress.show_progress = value;
        }
        if let Some(value) = settings.quiet_mode {
            self.progress.quiet_mode = value;
        }
        if let Some(value) = settings.decorations_enabled {
            self.progress.decorations_enabled = value;
        }
        self.dirty = true;
    }

    fn take_persisted_unlocks(&mut self) -> Vec<UnlockedEvent> {
        if self.dirty || self.save_error.is_some() || self.pending_unlocks.is_empty() {
            return Vec::new();
        }
        std::mem::take(&mut self.pending_unlocks)
            .into_iter()
            .map(|(theme_id, levels)| UnlockedEvent {
                equipped_level: self.progress.themes[&theme_id].equipped_level,
                theme_id,
                levels,
            })
            .collect()
    }

    fn flush(&mut self) -> Result<(), String> {
        self.last_save_attempt = Instant::now();
        self.save_requested = false;
        if self.save_blocked {
            return Err(self
                .save_error
                .clone()
                .unwrap_or_else(|| "已保护原存档，请先导入有效备份或重置".into()));
        }
        let mut next = self.progress.clone();
        next.advance_cycle();
        match save_progress(&self.directory, &next) {
            Ok(()) => {
                self.progress = next;
                self.dirty = false;
                self.save_error = None;
                self.last_saved_at = Some(now_millis());
                self.notify_pending = true;
                Ok(())
            }
            Err(error) => {
                let message = format!("成长进度保存失败，当前进度仍保留在内存中：{error}");
                self.save_error = Some(message.clone());
                self.notify_pending = true;
                Err(message)
            }
        }
    }

    // Rule/wardrobe edits are transactional: failed disk writes never publish or
    // apply a speculative threshold set, outfit selection, or equipment change.
    fn commit_edit(&mut self, next: Progress, archive_reason: Option<&str>) -> Result<(), String> {
        next.validate()?;
        if self.save_blocked {
            return Err(self
                .save_error
                .clone()
                .unwrap_or_else(|| "请先恢复受保护的存档".into()));
        }
        let result = (|| {
            if let Some(reason) = archive_reason {
                let archive = self
                    .directory
                    .join(format!("growth.pre-{reason}-{}.json", unique_suffix()));
                atomic_write(&archive, &serialize_progress(&self.progress)?)
                    .map_err(|error| error.to_string())?;
            }
            save_progress(&self.directory, &next)
        })();
        if let Err(error) = result {
            let message = format!("更改未生效，存档写入失败：{error}");
            self.save_error = Some(message.clone());
            self.notify_pending = true;
            return Err(message);
        }
        self.progress = next;
        self.dirty = false;
        self.save_requested = false;
        self.save_error = None;
        self.last_saved_at = Some(now_millis());
        self.last_save_attempt = Instant::now();
        self.notify_pending = true;
        Ok(())
    }

    fn update_theme_thresholds(
        next: &mut Progress,
        theme_id: &str,
        thresholds: [u64; 9],
        mode: ThresholdMode,
    ) -> Result<Vec<u8>, String> {
        let theme = next.themes.get_mut(theme_id).ok_or("不支持的成长主题")?;
        let previous_level = theme.unlocked_level;
        let previous_round_level = theme.round_level;
        theme.thresholds = thresholds;
        theme.threshold_mode = mode;
        theme.round_level = theme
            .round_level
            .max(level_for_thresholds(theme.round_presses, &thresholds));
        theme.unlocked_level = theme.unlocked_level.max(theme.round_level);
        if theme.round_level > previous_round_level && next.auto_equip {
            theme.equipped_level = theme.round_level;
        }
        Ok(((previous_level + 1)..=theme.unlocked_level).collect())
    }

    fn set_thresholds(&mut self, theme_id: &str, thresholds: [u64; 9]) -> Result<(), String> {
        validate_thresholds(&thresholds)?;
        let mut next = self.progress.clone();
        let levels =
            Self::update_theme_thresholds(&mut next, theme_id, thresholds, ThresholdMode::Custom)?;
        if theme_id == next.growth_theme_id {
            next.advance_cycle();
        }
        self.commit_edit(next, Some("thresholds"))?;
        if !levels.is_empty() {
            self.pending_unlocks
                .entry(theme_id.into())
                .or_default()
                .extend(levels);
        }
        Ok(())
    }

    fn set_weekly_plan(&mut self, daily_budget: u64, active_days: u8) -> Result<(), String> {
        let thresholds = weekly_thresholds(daily_budget, active_days)?;
        let mut next = self.progress.clone();
        next.daily_press_budget = daily_budget;
        next.active_days_per_week = active_days;
        let mut unlocked = BTreeMap::new();
        for id in THEME_IDS {
            if next.themes[id].threshold_mode == ThresholdMode::Weekly {
                let levels = Self::update_theme_thresholds(
                    &mut next,
                    id,
                    thresholds,
                    ThresholdMode::Weekly,
                )?;
                if !levels.is_empty() {
                    unlocked.insert(id, levels);
                }
            }
        }
        next.advance_cycle();
        self.commit_edit(next, Some("weekly-plan"))?;
        for (id, levels) in unlocked {
            self.pending_unlocks
                .entry(id.into())
                .or_default()
                .extend(levels);
        }
        Ok(())
    }

    fn use_weekly_thresholds(&mut self, theme_id: &str) -> Result<(), String> {
        let mut next = self.progress.clone();
        let thresholds = weekly_thresholds(next.daily_press_budget, next.active_days_per_week)?;
        let levels =
            Self::update_theme_thresholds(&mut next, theme_id, thresholds, ThresholdMode::Weekly)?;
        if theme_id == next.growth_theme_id {
            next.advance_cycle();
        }
        self.commit_edit(next, Some("thresholds"))?;
        if !levels.is_empty() {
            self.pending_unlocks
                .entry(theme_id.into())
                .or_default()
                .extend(levels);
        }
        Ok(())
    }

    fn set_outfit_theme(&mut self, theme_id: &str) -> Result<(), String> {
        if theme_id != "none" && !THEME_IDS.contains(&theme_id) {
            return Err("不支持的衣橱系列".into());
        }
        let mut next = self.progress.clone();
        next.outfit_theme_id = theme_id.into();
        self.commit_edit(next, None)
    }

    fn set_growth_theme(&mut self, theme_id: &str) -> Result<(), String> {
        if !THEME_IDS.contains(&theme_id) {
            return Err("不支持的成长主题".into());
        }
        let mut next = self.progress.clone();
        next.growth_theme_id = theme_id.into();
        self.commit_edit(next, None)?;
        // Pending rewards retain their theme; held keys remain physical across a theme switch.
        Ok(())
    }

    #[cfg(test)]
    fn equip(&mut self, level: u8) -> Result<(), String> {
        let id = self.progress.growth_theme_id.clone();
        self.equip_for_theme(&id, level)
    }

    fn equip_for_theme(&mut self, theme_id: &str, level: u8) -> Result<(), String> {
        let current = self
            .progress
            .themes
            .get(theme_id)
            .ok_or("不支持的衣橱系列")?;
        if !(1..=current.unlocked_level).contains(&level) {
            return Err("该套装尚未解锁".into());
        }
        let mut next = self.progress.clone();
        next.themes.get_mut(theme_id).unwrap().equipped_level = level;
        next.outfit_theme_id = theme_id.into();
        self.commit_edit(next, None)
    }

    fn replace_progress(&mut self, next: Progress, reason: &str) -> Result<(), String> {
        next.validate()?;
        // Save the actual current in-memory state, not merely the last ten-second checkpoint.
        let archive = self
            .directory
            .join(format!("growth.pre-{reason}-{}.json", unique_suffix()));
        let result = serialize_progress(&self.progress)
            .and_then(|bytes| atomic_write(&archive, &bytes).map_err(|error| error.to_string()))
            .and_then(|()| save_progress(&self.directory, &next));
        if let Err(error) = result {
            let message = format!("未替换进度：备份或写入失败：{error}");
            self.save_error = Some(message.clone());
            return Err(message);
        }
        self.progress = next;
        self.held_keys.clear();
        self.dirty = false;
        self.save_requested = false;
        self.pending_unlocks.clear();
        self.save_error = None;
        self.save_blocked = false;
        self.last_saved_at = Some(now_millis());
        self.last_save_attempt = Instant::now();
        Ok(())
    }
}

fn is_modifier(key: &str) -> bool {
    matches!(
        key,
        "Alt"
            | "AltGr"
            | "ControlLeft"
            | "ControlRight"
            | "MetaLeft"
            | "MetaRight"
            | "Meta"
            | "ShiftLeft"
            | "ShiftRight"
            | "Shift"
            | "Control"
            | "Fn"
            | "Function"
            | "CapsLock"
    )
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn unique_suffix() -> String {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    format!(
        "{}-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    )
}

fn read_progress(path: &Path) -> Result<Progress, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() > 64 * 1024 {
        return Err("存档文件过大".into());
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    Progress::parse(&text)
}

fn is_missing(path: &Path) -> bool {
    matches!(fs::metadata(path), Err(error) if error.kind() == io::ErrorKind::NotFound)
}

fn disk_schema_version(path: &Path) -> Option<u64> {
    if !fs::metadata(path).is_ok_and(|metadata| metadata.len() <= 64 * 1024) {
        return None;
    }
    let text = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&text).ok()?;
    value.get("schemaVersion")?.as_u64()
}

fn has_unsupported_version(path: &Path) -> bool {
    if fs::metadata(path).is_ok_and(|metadata| metadata.len() <= 64 * 1024) {
        if let Ok(text) = fs::read_to_string(path) {
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                return value
                    .get("schemaVersion")
                    .and_then(|version| version.as_u64())
                    .is_some_and(|version| {
                        version != 1
                            && version != 2
                            && version != 3
                            && version != SCHEMA_VERSION as u64
                    })
                    || value
                        .get("ruleVersion")
                        .and_then(|version| version.as_u64())
                        .is_some_and(|version| version != RULE_VERSION as u64);
            }
        }
    }
    false
}

fn serialize_progress(progress: &Progress) -> Result<Vec<u8>, String> {
    progress.validate()?;
    serde_json::to_vec_pretty(progress).map_err(|error| error.to_string())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing save directory"))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!(".growth-{}.tmp", unique_suffix()));
    let result = (|| {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        // Directory sync is supported on macOS/Unix; some platforms do not allow opening directories.
        if let Ok(directory) = File::open(parent) {
            let _ = directory.sync_all();
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn save_progress(directory: &Path, progress: &Progress) -> Result<(), String> {
    let next_bytes = serialize_progress(progress)?;
    let primary = directory.join("growth.json");
    let backup = directory.join("growth.backup.json");
    if read_progress(&primary).is_ok() {
        // Keep exact original v1/v2/v3 bytes before the first v4 write, so rollback
        // does not depend on reversing a migration or trusting derived aliases.
        let previous = fs::read(&primary).map_err(|error| error.to_string())?;
        if matches!(disk_schema_version(&primary), Some(1 | 2 | 3)) {
            let archive = directory.join(format!("growth.pre-migration-{}.json", unique_suffix()));
            atomic_write(&archive, &previous).map_err(|error| error.to_string())?;
        }
        if backup.exists() && read_progress(&backup).is_err() {
            // Preserve unknown/future or damaged backup bytes before normal rotation.
            // If the original cannot be read or archived, leave both save files untouched.
            let protected =
                directory.join(format!("growth.backup-protected-{}.json", unique_suffix()));
            let original = fs::read(&backup).map_err(|error| error.to_string())?;
            atomic_write(&protected, &original).map_err(|error| error.to_string())?;
        }
        atomic_write(&backup, &previous).map_err(|error| error.to_string())?;
    } else if primary.exists() {
        // Preserve the damaged source for recovery; never overwrite the last valid backup with it.
        let archive = directory.join(format!("growth.corrupt-{}.json", unique_suffix()));
        fs::copy(&primary, &archive).map_err(|error| error.to_string())?;
    }
    atomic_write(&primary, &next_bytes).map_err(|error| error.to_string())
}

pub struct GrowthService {
    inner: Arc<Mutex<GrowthInner>>,
    input_queue: Arc<Mutex<Vec<QueuedInput>>>,
    input_generation: Arc<AtomicU64>,
    input_route: Arc<Mutex<InputRoute>>,
    wake: SyncSender<()>,
    stopped: Arc<AtomicBool>,
}

#[derive(Clone, Copy)]
struct InputRoute {
    theme_id: &'static str,
    cycle_round: u64,
}

impl InputRoute {
    fn from_progress(progress: &Progress) -> Self {
        Self {
            theme_id: THEME_IDS
                .into_iter()
                .find(|id| *id == progress.growth_theme_id)
                .expect("validated active theme"),
            cycle_round: progress.cycle_round,
        }
    }
}

fn sync_input_route(route: &Mutex<InputRoute>, data: &GrowthInner) {
    *route
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) =
        InputRoute::from_progress(&data.progress);
}

struct QueuedInput {
    key: String,
    pressed: bool,
    generation: u64,
    theme_id: &'static str,
    cycle_round: u64,
}

fn drain_inputs(data: &mut GrowthInner, queue: &Mutex<Vec<QueuedInput>>, generation: &AtomicU64) {
    let events = {
        let mut queued = queue
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        std::mem::take(&mut *queued)
    };
    let current_generation = generation.load(Ordering::SeqCst);
    for event in events {
        if event.generation == current_generation {
            data.process_key_for_route(
                event.theme_id,
                event.cycle_round,
                &event.key,
                event.pressed,
            );
        }
    }
}

impl GrowthService {
    fn lock(&self) -> MutexGuard<'_, GrowthInner> {
        self.inner
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn drain(&self, data: &mut GrowthInner) {
        drain_inputs(data, &self.input_queue, &self.input_generation);
    }

    fn clear_input_generation(&self) {
        self.input_generation.fetch_add(1, Ordering::SeqCst);
    }

    fn sync_input_theme(&self, data: &GrowthInner) {
        sync_input_route(&self.input_route, data);
    }

    // No storage lock or filesystem work: input continues to queue during a slow commit.
    fn enqueue_input(&self, key: String, pressed: bool) {
        let generation = self.input_generation.load(Ordering::SeqCst);
        // One short route read keeps theme and round coherent; this mutex is
        // never held while saving, emitting UI events, or taking the storage lock.
        let route = *self
            .input_route
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        self.input_queue
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push(QueuedInput {
                key,
                pressed,
                generation,
                theme_id: route.theme_id,
                cycle_round: route.cycle_round,
            });
        let _ = self.wake.try_send(());
    }
}

pub fn initialize<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let loaded = GrowthInner::load(directory);
    let input_route = Arc::new(Mutex::new(InputRoute::from_progress(&loaded.progress)));
    let inner = Arc::new(Mutex::new(loaded));
    let input_queue = Arc::new(Mutex::new(Vec::new()));
    let input_generation = Arc::new(AtomicU64::new(0));
    let stopped = Arc::new(AtomicBool::new(false));
    let (wake, receive) = mpsc::sync_channel(1);
    app.manage(GrowthService {
        inner: inner.clone(),
        input_queue: input_queue.clone(),
        input_generation: input_generation.clone(),
        input_route: input_route.clone(),
        wake,
        stopped: stopped.clone(),
    });
    let handle = app.clone();
    let spawned = std::thread::Builder::new()
        .name("growth-storage".into())
        .spawn(move || {
            let mut previous_tick = SystemTime::now();
            while !stopped.load(Ordering::SeqCst) {
                let _ = receive.recv_timeout(SNAPSHOT_INTERVAL);
                if stopped.load(Ordering::SeqCst) {
                    break;
                }
                let now = SystemTime::now();
                {
                    let mut data = inner
                        .lock()
                        .unwrap_or_else(|poisoned| poisoned.into_inner());
                    // A timer gap marks suspend/resume or a clock change; never retain stale held keys.
                    data.handle_timer_gap(now.duration_since(previous_tick).ok());
                    previous_tick = now;
                    drain_inputs(&mut data, &input_queue, &input_generation);
                    let previous_error = data.save_error.clone();
                    if data.dirty
                        && (data.save_requested
                            || data.last_save_attempt.elapsed() >= SAVE_INTERVAL)
                    {
                        let _ = data.flush();
                        sync_input_route(&input_route, &data);
                    }
                    let error_changed = data.save_error != previous_error;
                    let has_persisted_unlock = !data.dirty
                        && data.save_error.is_none()
                        && !data.pending_unlocks.is_empty();
                    if error_changed
                        || has_persisted_unlock
                        || (data.notify_pending && data.last_emit.elapsed() >= SNAPSHOT_INTERVAL)
                    {
                        publish_snapshot(&handle, &mut data);
                    }
                }
            }
        });
    if let Err(error) = spawned {
        let service = app.state::<GrowthService>();
        service.stopped.store(true, Ordering::SeqCst);
        let mut data = service.lock();
        data.progress.paused = true;
        data.save_error = Some(format!("后台成长线程启动失败，已暂停计数：{error}"));
    }
    Ok(())
}

// Publish while holding the state lock so background saves and UI commands cannot
// emit an older snapshot after a newer one. Tauri emit only queues the JS event.
fn publish_snapshot<R: Runtime>(app: &AppHandle<R>, data: &mut GrowthInner) -> GrowthSnapshot {
    if let Some(service) = app.try_state::<GrowthService>() {
        service.sync_input_theme(data);
    }
    let unlocked = data.take_persisted_unlocks();
    let snapshot = data.take_snapshot();
    let _ = app.emit("growth-changed", snapshot.clone());
    for unlocked in unlocked {
        let _ = app.emit("growth-unlocked", unlocked);
    }
    snapshot
}

pub fn handle_input<R: Runtime>(app: &AppHandle<R>, event: &EventType) {
    let (key, pressed) = match event {
        EventType::KeyPress(key) => (format!("{key:?}"), true),
        EventType::KeyRelease(key) => (format!("{key:?}"), false),
        _ => return, // Pointer/scroll/gamepad input animates the pet but never awards keyboard XP.
    };
    let Some(service) = app.try_state::<GrowthService>() else {
        return;
    };
    if service.stopped.load(Ordering::SeqCst) {
        return;
    }
    service.enqueue_input(key, pressed);
}

pub fn set_listener_state<R: Runtime>(app: &AppHandle<R>, listening: bool, error: Option<String>) {
    let Some(service) = app.try_state::<GrowthService>() else {
        return;
    };
    let mut data = service.lock();
    service.drain(&mut data);
    service.clear_input_generation();
    data.listening = listening;
    data.listener_error = error;
    data.held_keys.clear();
    publish_snapshot(app, &mut data);
}

pub fn shutdown<R: Runtime>(app: &AppHandle<R>) {
    if let Some(service) = app.try_state::<GrowthService>() {
        service.stopped.store(true, Ordering::SeqCst);
        let _ = service.wake.try_send(());
        let mut data = service.lock();
        service.drain(&mut data);
        if data.dirty {
            let _ = data.flush();
        }
    }
}

#[command]
pub fn growth_get_state(state: State<'_, GrowthService>) -> GrowthSnapshot {
    let mut data = state.lock();
    state.drain(&mut data);
    data.snapshot()
}

#[command]
pub fn growth_update_settings<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    settings: GrowthSettings,
) -> GrowthSnapshot {
    let mut data = state.lock();
    state.drain(&mut data);
    if settings.paused.is_some() {
        state.clear_input_generation();
    }
    data.update_settings(settings);
    let _ = data.flush();
    publish_snapshot(&app, &mut data)
}

#[command]
pub fn growth_equip<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    level: u8,
    theme_id: Option<String>,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    let id = theme_id.unwrap_or_else(|| data.progress.growth_theme_id.clone());
    data.equip_for_theme(&id, level)?;
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_set_thresholds<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    theme_id: String,
    thresholds: Vec<u64>,
) -> Result<GrowthSnapshot, String> {
    let thresholds: [u64; 9] = thresholds.try_into().map_err(|_| "升级门槛必须恰好为9项")?;
    let mut data = state.lock();
    state.drain(&mut data);
    data.set_thresholds(&theme_id, thresholds)?;
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_set_weekly_plan<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    daily_press_budget: u64,
    active_days_per_week: u8,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    data.set_weekly_plan(daily_press_budget, active_days_per_week)?;
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_use_weekly_thresholds<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    theme_id: String,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    data.use_weekly_thresholds(&theme_id)?;
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_set_outfit_theme<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    theme_id: String,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    data.set_outfit_theme(&theme_id)?;
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_set_growth_theme<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    theme_id: String,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    data.set_growth_theme(&theme_id)?;
    state.sync_input_theme(&data);
    Ok(publish_snapshot(&app, &mut data))
}

#[command]
pub fn growth_export(state: State<'_, GrowthService>) -> Result<String, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    serde_json::to_string_pretty(&data.progress).map_err(|error| error.to_string())
}

#[command]
pub fn growth_import<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
    json: String,
) -> Result<GrowthSnapshot, String> {
    let next = Progress::parse(&json)?;
    let mut data = state.lock();
    state.drain(&mut data);
    let result = data.replace_progress(next, "import");
    if result.is_ok() {
        state.sync_input_theme(&data);
        state.clear_input_generation();
    }
    let snapshot = publish_snapshot(&app, &mut data);
    result.map(|()| snapshot)
}

#[command]
pub fn growth_reset<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, GrowthService>,
) -> Result<GrowthSnapshot, String> {
    let mut data = state.lock();
    state.drain(&mut data);
    let mut next = data.progress.clone();
    next.total_presses = 0;
    next.cycle_round = 1;
    for theme in next.themes.values_mut() {
        theme.presses = 0;
        theme.round_presses = 0;
        theme.round_level = 1;
        theme.unlocked_level = 1;
        theme.equipped_level = 1;
    }
    let result = data.replace_progress(next, "reset");
    if result.is_ok() {
        state.clear_input_generation();
    }
    let snapshot = publish_snapshot(&app, &mut data);
    result.map(|()| snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestDirectory(PathBuf);
    impl TestDirectory {
        fn new() -> Self {
            let path =
                std::env::temp_dir().join(format!("bongocat-growth-test-{}", unique_suffix()));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn progress_at(presses: u64) -> Progress {
        let mut progress = Progress::default();
        progress.total_presses = presses;
        let level = level_for_thresholds(presses, &LEGACY_THRESHOLDS);
        progress.auto_cycle = false;
        progress.active_mut().thresholds = LEGACY_THRESHOLDS;
        progress.active_mut().threshold_mode = ThresholdMode::Custom;
        progress.active_mut().presses = presses;
        progress.active_mut().round_presses = presses;
        progress.active_mut().round_level = level;
        progress.active_mut().unlocked_level = level;
        progress.active_mut().equipped_level = level;
        progress
    }

    #[test]
    fn thresholds_include_boundary_and_saturate_at_nine() {
        for (index, threshold) in THRESHOLDS.iter().enumerate() {
            assert_eq!(
                level_for_thresholds(*threshold, &THRESHOLDS),
                index as u8 + 1
            );
            if *threshold > 0 {
                assert_eq!(
                    level_for_thresholds(*threshold - 1, &THRESHOLDS),
                    index as u8
                );
            }
        }
        assert_eq!(level_for_thresholds(MAX_SAFE_COUNT, &THRESHOLDS), 9);
    }

    #[test]
    fn repeated_keydown_and_modifiers_do_not_award_xp() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        for _ in 0..50 {
            state.process_key("KeyA", true);
        }
        assert_eq!(state.progress.total_presses, 1);
        state.process_key("KeyA", false);
        state.process_key("KeyA", true);
        for key in [
            "MetaLeft",
            "ShiftRight",
            "ControlLeft",
            "Alt",
            "Fn",
            "CapsLock",
        ] {
            state.process_key(key, true);
        }
        assert_eq!(state.progress.total_presses, 2);
        assert_eq!(state.progress.active().presses, 2);
    }

    #[test]
    fn pause_discards_input_and_resume_clears_held_keys() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        state.update_settings(GrowthSettings {
            paused: Some(true),
            ..Default::default()
        });
        state.process_key("KeyB", true);
        assert_eq!(state.progress.total_presses, 1);
        state.update_settings(GrowthSettings {
            paused: Some(false),
            ..Default::default()
        });
        state.process_key("KeyA", true);
        assert_eq!(state.progress.total_presses, 2);
    }

    #[test]
    fn suspend_and_clock_changes_clear_only_ephemeral_key_state() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        state.handle_timer_gap(Some(Duration::from_secs(1)));
        assert!(state.held_keys.contains("KeyA"));
        state.handle_timer_gap(Some(Duration::from_secs(30)));
        assert!(state.held_keys.is_empty());
        assert_eq!(state.progress.total_presses, 1);
        state.process_key("KeyB", true);
        state.handle_timer_gap(None);
        assert!(state.held_keys.is_empty());
        assert_eq!(state.progress.total_presses, 2);
    }

    #[test]
    fn queued_events_from_before_pause_or_import_are_discarded() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        let queue = Mutex::new(vec![
            QueuedInput {
                key: "KeyA".into(),
                pressed: true,
                generation: 0,
                theme_id: "wizard",
                cycle_round: 1,
            },
            QueuedInput {
                key: "KeyB".into(),
                pressed: true,
                generation: 1,
                theme_id: "wizard",
                cycle_round: 1,
            },
            QueuedInput {
                key: "KeyB".into(),
                pressed: true,
                generation: 1,
                theme_id: "wizard",
                cycle_round: 1,
            },
        ]);
        drain_inputs(&mut state, &queue, &AtomicU64::new(1));
        assert_eq!(state.progress.total_presses, 1);
        assert!(!state.held_keys.contains("KeyA"));
        assert!(queue.lock().unwrap().is_empty());
    }

    #[test]
    fn level_unlock_is_once_and_auto_equip_can_be_disabled() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(1_999);
        assert_eq!(state.process_key("KeyA", true), vec![2]);
        assert_eq!(state.progress.active().equipped_level, 2);
        assert!(state.process_key("KeyA", true).is_empty());
        state.progress.total_presses = 7_999;
        state.progress.active_mut().presses = 7_999;
        state.progress.active_mut().round_presses = 7_999;
        state.progress.auto_equip = false;
        assert_eq!(state.process_key("KeyB", true), vec![3]);
        assert_eq!(state.progress.active().equipped_level, 2);
    }

    #[test]
    fn invalid_imports_reject_versions_counts_locked_equipment_and_unknown_fields() {
        let valid = serde_json::to_value(Progress::default()).unwrap();
        for (key, value) in [
            ("schemaVersion", json!(999)),
            ("ruleVersion", json!(0)),
            ("themePresses", json!(1)),
            ("totalPresses", json!(-1)),
            ("totalPresses", json!(MAX_SAFE_COUNT + 1)),
            ("equippedLevel", json!(9)),
            ("unexpected", json!(true)),
        ] {
            let mut invalid = valid.clone();
            invalid[key] = value;
            assert!(
                Progress::parse(&invalid.to_string()).is_err(),
                "accepted {key}"
            );
        }
        assert!(Progress::parse(&valid.to_string()).is_ok());
        assert!(Progress::parse("{}").is_err());
    }

    #[test]
    fn corrupt_primary_recovers_backup_and_preserves_it_on_next_save() {
        let directory = TestDirectory::new();
        let first = progress_at(20);
        save_progress(&directory.0, &first).unwrap();
        let second = progress_at(30);
        save_progress(&directory.0, &second).unwrap();
        fs::write(directory.0.join("growth.json"), "broken").unwrap();
        let mut recovered = GrowthInner::load(directory.0.clone());
        assert_eq!(recovered.progress.total_presses, 20);
        assert!(recovered.save_error.is_some());
        recovered.flush().unwrap();
        assert_eq!(
            read_progress(&directory.0.join("growth.backup.json"))
                .unwrap()
                .total_presses,
            20
        );
        assert!(fs::read_dir(&directory.0).unwrap().any(|entry| {
            entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .starts_with("growth.corrupt-")
        }));
    }

    #[test]
    fn backup_failure_leaves_primary_and_dirty_progress_intact() {
        let directory = TestDirectory::new();
        save_progress(&directory.0, &Progress::default()).unwrap();
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        assert!(state.flush().is_err());
        assert!(state.dirty);
        assert!(state.save_error.is_some());
        assert_eq!(state.progress.total_presses, 1);
        assert_eq!(
            read_progress(&directory.0.join("growth.json"))
                .unwrap()
                .total_presses,
            0
        );
    }

    #[test]
    fn unlock_notification_waits_for_successful_save_and_is_consumed_once() {
        let directory = TestDirectory::new();
        let before = progress_at(1_999);
        save_progress(&directory.0, &before).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        assert_eq!(state.process_key("KeyA", true), vec![2]);
        assert!(state.take_persisted_unlocks().is_empty());
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        assert!(state.flush().is_err());
        assert!(state.take_persisted_unlocks().is_empty());
        assert_eq!(state.pending_unlocks["wizard"], vec![2]);
        fs::remove_dir(directory.0.join("growth.backup.json")).unwrap();
        state.flush().unwrap();
        assert_eq!(
            read_progress(&directory.0.join("growth.json"))
                .unwrap()
                .active()
                .presses,
            2_000
        );
        assert_eq!(state.take_persisted_unlocks().remove(0).levels, vec![2]);
        assert!(state.take_persisted_unlocks().is_empty());
        assert!(state.snapshot().save_error.is_none());
    }

    #[test]
    fn unreadable_or_future_version_save_is_not_silently_replaced() {
        let directory = TestDirectory::new();
        let mut future = serde_json::to_value(Progress::default()).unwrap();
        future["schemaVersion"] = json!(99);
        let original = future.to_string();
        fs::write(directory.0.join("growth.json"), &original).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        assert!(state.flush().is_err());
        assert!(state.save_blocked);
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.json")).unwrap(),
            original
        );
        atomic_write(
            &directory.0.join("growth.backup.json"),
            &serialize_progress(&Progress::default()).unwrap(),
        )
        .unwrap();
        let mut with_backup = GrowthInner::load(directory.0.clone());
        assert!(with_backup.flush().is_err());
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.json")).unwrap(),
            original
        );
        state
            .replace_progress(Progress::default(), "reset")
            .unwrap();
        assert!(!state.save_blocked);
    }

    #[test]
    fn import_archives_unsaved_progress_and_failed_import_is_transactional() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.process_key("KeyA", true);
        let imported = progress_at(8_000);
        state.replace_progress(imported, "import").unwrap();
        assert_eq!(state.progress.total_presses, 8_000);
        let archive = fs::read_dir(&directory.0)
            .unwrap()
            .find(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .starts_with("growth.pre-import-")
            })
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(read_progress(&archive).unwrap().total_presses, 1);
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        assert!(
            state
                .replace_progress(Progress::default(), "import")
                .is_err()
        );
        assert_eq!(state.progress.total_presses, 8_000);
    }

    #[test]
    fn legacy_migration_preserves_counts_equipment_settings_and_exact_original_backup() {
        let directory = TestDirectory::new();
        let legacy = json!({
            "schemaVersion": 1, "ruleVersion": 1, "totalPresses": 12_345,
            "themePresses": 8_500, "equippedLevel": 2, "paused": true,
            "autoEquip": false, "reducedMotion": false, "showProgress": false, "quietMode": true
        })
        .to_string();
        fs::write(directory.0.join("growth.json"), &legacy).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        assert!(!state.save_blocked);
        assert!(state.dirty && state.save_requested);
        assert_eq!(state.progress.schema_version, SCHEMA_VERSION);
        assert_eq!(state.progress.total_presses, 12_345);
        assert_eq!(state.progress.active().presses, 8_500);
        assert_eq!(state.progress.active().unlocked_level, 4);
        assert_eq!(state.progress.active().equipped_level, 2);
        assert!(state.progress.paused && state.progress.quiet_mode);
        assert!(
            !state.progress.auto_equip
                && !state.progress.reduced_motion
                && !state.progress.show_progress
        );
        state.flush().unwrap();
        assert_eq!(
            disk_schema_version(&directory.0.join("growth.json")),
            Some(SCHEMA_VERSION as u64)
        );
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.backup.json")).unwrap(),
            legacy
        );
        let archive = fs::read_dir(&directory.0)
            .unwrap()
            .find(|entry| {
                entry
                    .as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .starts_with("growth.pre-migration-")
            })
            .unwrap()
            .unwrap()
            .path();
        assert_eq!(fs::read_to_string(archive).unwrap(), legacy);
    }

    #[test]
    #[ignore = "requires BONGOCAT_MIGRATION_FIXTURE pointing to a read-only copied v1 save"]
    fn real_v1_fixture_migrates_without_changing_counts_equipment_or_five_settings() {
        let fixture = std::env::var("BONGOCAT_MIGRATION_FIXTURE").expect("copied fixture path");
        let original = fs::read_to_string(&fixture).expect("read copied fixture only");
        let old: serde_json::Value = serde_json::from_str(&original).unwrap();
        assert_eq!(old["schemaVersion"], json!(1));
        let directory = TestDirectory::new();
        fs::write(directory.0.join("growth.json"), &original).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        assert!(!state.save_blocked);
        let snapshot = serde_json::to_value(state.snapshot()).unwrap();
        assert_eq!(snapshot["schemaVersion"], json!(SCHEMA_VERSION));
        for field in [
            "totalPresses",
            "themePresses",
            "equippedLevel",
            "paused",
            "autoEquip",
            "reducedMotion",
            "showProgress",
            "quietMode",
        ] {
            assert_eq!(snapshot[field], old[field], "migration changed {field}");
        }
        state.flush().unwrap();
        let exported =
            serde_json::to_value(read_progress(&directory.0.join("growth.json")).unwrap()).unwrap();
        assert_eq!(exported["themes"]["wizard"]["presses"], old["themePresses"]);
        assert_eq!(
            exported["themes"]["wizard"]["equippedLevel"],
            old["equippedLevel"]
        );
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.backup.json")).unwrap(),
            original
        );
        assert_eq!(
            fs::read_to_string(fixture).unwrap(),
            original,
            "source fixture was modified"
        );
    }

    #[test]
    fn thresholds_require_zero_strict_increase_safe_integers_and_nine_values() {
        assert!(validate_thresholds(&THRESHOLDS).is_ok());
        for bad in [
            [1, 2, 3, 4, 5, 6, 7, 8, 9],
            [0, 2, 2, 4, 5, 6, 7, 8, 9],
            [0, 3, 2, 4, 5, 6, 7, 8, 9],
            [0, 1, 2, 3, 4, 5, 6, 7, MAX_SAFE_COUNT + 1],
        ] {
            assert!(validate_thresholds(&bad).is_err());
        }
        let valid = serde_json::to_value(Progress::default()).unwrap();
        for bad in [
            json!([0, 1]),
            json!([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
            json!([0, 1.5, 2, 3, 4, 5, 6, 7, 8]),
            json!([0, -1, 2, 3, 4, 5, 6, 7, 8]),
        ] {
            let mut invalid = valid.clone();
            invalid["themes"]["wizard"]["thresholds"] = bad;
            assert!(Progress::parse(&invalid.to_string()).is_err());
        }
    }

    #[test]
    fn raising_thresholds_preserves_unlocks_equipment_and_roundtrip() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(20_000);
        state.progress.active_mut().equipped_level = 3;
        let higher = [
            0, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000, 200_000, 400_000,
        ];
        state.set_thresholds("wizard", higher).unwrap();
        assert_eq!(state.snapshot().level, 4);
        assert_eq!(state.snapshot().equipped_level, 3);
        assert_eq!(state.snapshot().unlocked_levels, vec![1, 2, 3, 4]);
        assert!(state.take_persisted_unlocks().is_empty());
        let reloaded = GrowthInner::load(directory.0.clone());
        assert_eq!(reloaded.snapshot().level, 4);
        assert_eq!(reloaded.snapshot().thresholds, higher);
        state.process_key("KeyA", true);
        assert_eq!(state.snapshot().level, 4);
        state.equip(4).unwrap();
        assert_eq!(state.snapshot().equipped_level, 4);
    }

    #[test]
    fn lowering_thresholds_unlocks_only_new_levels_after_commit_once() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(100);
        state
            .set_thresholds("wizard", [0, 10, 20, 30, 40, 50, 60, 70, 80])
            .unwrap();
        assert_eq!(
            read_progress(&directory.0.join("growth.json"))
                .unwrap()
                .active()
                .unlocked_level,
            9
        );
        let event = state.take_persisted_unlocks().remove(0);
        assert_eq!(event.theme_id, "wizard");
        assert_eq!(event.levels, (2..=9).collect::<Vec<_>>());
        assert_eq!(event.equipped_level, 9);
        assert!(state.take_persisted_unlocks().is_empty());
        state
            .set_thresholds("wizard", [0, 10, 20, 30, 40, 50, 60, 70, 80])
            .unwrap();
        assert!(state.take_persisted_unlocks().is_empty());
    }

    #[test]
    fn threshold_and_outfit_failures_leave_memory_disk_and_unlock_notifications_unchanged() {
        let directory = TestDirectory::new();
        save_progress(&directory.0, &progress_at(100)).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        let before = serde_json::to_value(&state.progress).unwrap();
        assert!(
            state
                .set_thresholds("wizard", [0, 10, 20, 30, 40, 50, 60, 70, 80])
                .is_err()
        );
        assert_eq!(serde_json::to_value(&state.progress).unwrap(), before);
        assert_eq!(
            serde_json::to_value(read_progress(&directory.0.join("growth.json")).unwrap()).unwrap(),
            before
        );
        assert!(state.take_persisted_unlocks().is_empty());
        assert!(state.set_outfit_theme("none").is_err());
        assert_eq!(state.progress.outfit_theme_id, "wizard");
        assert!(state.snapshot().save_error.is_some());
    }

    #[test]
    fn no_outfit_keeps_training_and_does_not_reappear_on_upgrade_or_auto_equip() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(1_999);
        state.set_outfit_theme("none").unwrap();
        assert_eq!(state.process_key("KeyA", true), vec![2]);
        assert_eq!(state.progress.total_presses, 2_000);
        assert_eq!(state.progress.active().presses, 2_000);
        assert_eq!(state.progress.outfit_theme_id, "none");
        state.update_settings(GrowthSettings {
            auto_equip: Some(true),
            ..Default::default()
        });
        assert_eq!(state.progress.outfit_theme_id, "none");
        assert_eq!(state.progress.active().equipped_level, 2);
        state.flush().unwrap();
        let exported = serde_json::to_value(&state.progress).unwrap();
        assert!(exported.get("interactionMode").is_none());
        assert!(exported.get("themePresses").is_none());
        state.equip(1).unwrap();
        assert_eq!(state.progress.outfit_theme_id, "wizard");
        assert_eq!(state.progress.active().equipped_level, 1);
        assert_eq!(state.progress.active().unlocked_level, 2);
    }

    #[test]
    fn invalid_theme_and_inconsistent_explicit_unlocks_are_rejected() {
        let mut value = serde_json::to_value(Progress::default()).unwrap();
        value["outfitThemeId"] = json!("unsupported");
        assert!(Progress::parse(&value.to_string()).is_err());
        value["outfitThemeId"] = json!("none");
        value["growthThemeId"] = json!("none");
        assert!(Progress::parse(&value.to_string()).is_err());
        value = serde_json::to_value(progress_at(8_000)).unwrap();
        value["themes"]["wizard"]["unlockedLevel"] = json!(2);
        assert!(Progress::parse(&value.to_string()).is_err());
        value = serde_json::to_value(Progress::default()).unwrap();
        value["themes"]["wizard"]["equippedLevel"] = json!(2);
        assert!(Progress::parse(&value.to_string()).is_err());
    }

    #[test]
    fn v2_upgrade_adds_empty_themes_preserving_real_shape_and_original_bytes() {
        let directory = TestDirectory::new();
        let old = json!({"schemaVersion":2,"ruleVersion":1,"totalPresses":2178,
            "growthThemeId":"wizard","outfitThemeId":"wizard",
            "themes":{"wizard":{"presses":2178,"thresholds":LEGACY_THRESHOLDS,"unlockedLevel":2,"equippedLevel":2}},
            "paused":false,"autoEquip":true,"reducedMotion":true,"showProgress":true,"quietMode":false}).to_string();
        fs::write(directory.0.join("growth.json"), &old).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        assert!(!state.save_blocked);
        assert_eq!(state.progress.themes.len(), 12);
        assert_eq!(state.progress.total_presses, 2178);
        assert_eq!(state.progress.active().presses, 2178);
        assert_eq!(state.progress.active().equipped_level, 2);
        assert!(state.progress.decorations_enabled);
        for id in THEME_IDS.into_iter().filter(|id| *id != "wizard") {
            assert_eq!(state.progress.themes[id].presses, 0);
            assert_eq!(state.progress.themes[id].unlocked_level, 1);
        }
        state.flush().unwrap();
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.backup.json")).unwrap(),
            old
        );
    }

    #[test]
    fn training_wearing_and_scene_decoration_remain_independent() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(1999);
        state.equip_for_theme("emperor", 1).unwrap();
        state.update_settings(GrowthSettings {
            decorations_enabled: Some(false),
            ..Default::default()
        });
        assert_eq!(state.process_key("KeyA", true), vec![2]);
        assert_eq!(state.progress.outfit_theme_id, "emperor");
        assert_eq!(state.progress.themes["wizard"].presses, 2000);
        state.set_growth_theme("cultivation").unwrap();
        assert_eq!(state.pending_unlocks["wizard"], vec![2]);
        state.process_key("KeyA", false);
        state.process_key("KeyA", true);
        assert_eq!(state.progress.themes["cultivation"].presses, 1);
        assert_eq!(state.progress.themes["wizard"].presses, 2000);
        assert_eq!(state.progress.total_presses, 2001);
        assert_eq!(state.progress.outfit_theme_id, "emperor");
        assert!(!state.progress.decorations_enabled);
        state
            .set_thresholds("cultivation", [0, 1, 2, 3, 4, 5, 6, 7, 8])
            .unwrap();
        assert_eq!(state.progress.active().unlocked_level, 2);
        assert_eq!(state.progress.outfit_theme_id, "emperor");
        state.equip_for_theme("wizard", 2).unwrap();
        assert_eq!(state.progress.growth_theme_id, "cultivation");
        assert_eq!(state.progress.outfit_theme_id, "wizard");
        assert!(state.equip_for_theme("emperor", 2).is_err());
    }

    #[test]
    fn inactive_threshold_change_emits_unlock_for_its_own_theme() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = progress_at(100);
        state.set_growth_theme("shaolin").unwrap();
        state
            .set_thresholds("wizard", [0, 10, 20, 30, 40, 50, 60, 70, 80])
            .unwrap();
        assert_eq!(state.progress.themes["wizard"].unlocked_level, 9);
        assert_eq!(state.progress.active().unlocked_level, 1);
        let events = state.take_persisted_unlocks();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].theme_id, "wizard");
        assert_eq!(events[0].levels, (2..=9).collect::<Vec<_>>());
        assert!(state.take_persisted_unlocks().is_empty());
    }

    #[test]
    fn current_schema_rejects_missing_theme_instead_of_resetting_it() {
        let mut value = serde_json::to_value(Progress::default()).unwrap();
        value["themes"].as_object_mut().unwrap().remove("emperor");
        assert!(Progress::parse(&value.to_string()).is_err());
    }

    #[test]
    fn pending_rewards_survive_theme_switch_and_failed_save_with_original_owners() {
        let directory = TestDirectory::new();
        let mut data = GrowthInner::load(directory.0.clone());
        data.progress = progress_at(1_999);
        data.progress
            .themes
            .insert("cultivation".into(), progress_at(1_999).active().clone());
        data.progress.total_presses = 3_998;
        data.process_key("KeyA", true);
        data.process_key("KeyA", false);
        data.set_growth_theme("cultivation").unwrap();
        data.process_key("KeyB", true);
        assert!(data.take_persisted_unlocks().is_empty());
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        assert!(data.flush().is_err());
        assert!(data.take_persisted_unlocks().is_empty());
        assert_eq!(data.pending_unlocks.len(), 2);
        fs::remove_dir(directory.0.join("growth.backup.json")).unwrap();
        data.flush().unwrap();
        let events = data.take_persisted_unlocks();
        assert_eq!(events.len(), 2);
        for event in events {
            assert!(["wizard", "cultivation"].contains(&event.theme_id.as_str()));
            assert_eq!(event.levels, vec![2]);
            assert_eq!(event.equipped_level, 2);
        }
        assert!(data.take_persisted_unlocks().is_empty());
    }

    fn test_service(directory: PathBuf) -> Arc<GrowthService> {
        let (wake, _) = mpsc::sync_channel(1);
        let service = Arc::new(GrowthService {
            inner: Arc::new(Mutex::new(GrowthInner::load(directory))),
            input_queue: Arc::new(Mutex::new(Vec::new())),
            input_generation: Arc::new(AtomicU64::new(0)),
            input_route: Arc::new(Mutex::new(InputRoute::from_progress(&Progress::default()))),
            wake,
            stopped: Arc::new(AtomicBool::new(false)),
        });
        service.sync_input_theme(&service.lock());
        service
    }

    #[test]
    fn input_queues_while_storage_is_locked_and_keeps_theme_across_commit() {
        let directory = TestDirectory::new();
        let service = test_service(directory.0.clone());
        let mut data = service.lock();
        let producer = service.clone();
        let (done, received) = mpsc::channel();
        let thread = std::thread::spawn(move || {
            producer.enqueue_input("KeyA".into(), true);
            producer.enqueue_input("KeyA".into(), false);
            done.send(()).unwrap();
        });
        // Input completes while the storage lock is held, including a slow commit.
        received.recv_timeout(Duration::from_secs(2)).unwrap();
        thread.join().unwrap();
        data.set_growth_theme("cultivation").unwrap();
        service.sync_input_theme(&data);
        service.enqueue_input("KeyB".into(), true);
        service.enqueue_input("KeyB".into(), false);
        service.drain(&mut data);
        assert_eq!(data.progress.total_presses, 2);
        assert_eq!(data.progress.themes["wizard"].presses, 1);
        assert_eq!(data.progress.themes["cultivation"].presses, 1);
        assert_eq!(service.input_generation.load(Ordering::SeqCst), 0);
        assert!(service.input_queue.lock().unwrap().is_empty());
    }

    #[test]
    fn theme_switch_does_not_turn_held_key_repeat_into_another_press() {
        let directory = TestDirectory::new();
        let service = test_service(directory.0.clone());
        service.enqueue_input("KeyA".into(), true);
        let mut data = service.lock();
        service.drain(&mut data);
        data.set_growth_theme("shaolin").unwrap();
        service.sync_input_theme(&data);
        service.enqueue_input("KeyA".into(), true);
        service.enqueue_input("KeyA".into(), false);
        service.enqueue_input("KeyA".into(), true);
        service.drain(&mut data);
        assert_eq!(data.progress.total_presses, 2);
        assert_eq!(data.progress.themes["wizard"].presses, 1);
        assert_eq!(data.progress.themes["shaolin"].presses, 1);
    }

    #[test]
    fn failed_theme_commit_leaves_queued_input_routing_unchanged() {
        let directory = TestDirectory::new();
        save_progress(&directory.0, &Progress::default()).unwrap();
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        let service = test_service(directory.0.clone());
        let mut data = service.lock();
        service.enqueue_input("KeyA".into(), true);
        assert!(data.set_growth_theme("emperor").is_err());
        service.drain(&mut data);
        assert_eq!(data.progress.growth_theme_id, "wizard");
        assert_eq!(data.progress.themes["wizard"].presses, 1);
        assert_eq!(data.progress.themes["emperor"].presses, 0);
    }

    #[test]
    fn future_and_damaged_backup_bytes_are_preserved_before_rotation() {
        let mut future = serde_json::to_value(Progress::default()).unwrap();
        future["schemaVersion"] = json!(99);
        for original in [future.to_string().into_bytes(), vec![0xff, b'{', b'x']] {
            let directory = TestDirectory::new();
            save_progress(&directory.0, &Progress::default()).unwrap();
            fs::write(directory.0.join("growth.backup.json"), &original).unwrap();
            save_progress(&directory.0, &progress_at(1)).unwrap();
            let archives: Vec<_> = fs::read_dir(&directory.0)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| {
                    entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("growth.backup-protected-")
                })
                .collect();
            assert_eq!(archives.len(), 1);
            assert_eq!(fs::read(archives[0].path()).unwrap(), original);
            assert_eq!(
                read_progress(&directory.0.join("growth.backup.json"))
                    .unwrap()
                    .total_presses,
                0
            );
            assert_eq!(
                read_progress(&directory.0.join("growth.json"))
                    .unwrap()
                    .total_presses,
                1
            );
        }
    }

    fn short_cycle_progress() -> Progress {
        let mut progress = Progress::default();
        for theme in progress.themes.values_mut() {
            theme.threshold_mode = ThresholdMode::Custom;
            theme.thresholds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
        }
        progress
    }

    fn set_theme_at(progress: &mut Progress, id: &str, presses: u64) {
        let theme = progress.themes.get_mut(id).unwrap();
        progress.total_presses = progress.total_presses - theme.presses + presses;
        theme.presses = presses;
        theme.round_presses = presses;
        theme.round_level = level_for_thresholds(presses, &theme.thresholds);
        theme.unlocked_level = theme.round_level;
        theme.equipped_level = theme.round_level;
    }

    #[test]
    fn weekly_recipe_is_exact_monotone_and_safe_even_at_small_and_maximum_targets() {
        assert_eq!(weekly_thresholds(5_000, 5).unwrap(), THRESHOLDS);
        assert_eq!(
            weekly_thresholds(8, 1).unwrap(),
            [0, 1, 2, 3, 4, 5, 6, 7, 8]
        );
        for days in 1..=7 {
            for budget in [8, 9, 17, 100, 5_000, MAX_DAILY_PRESS_BUDGET] {
                let generated = weekly_thresholds(budget, days).unwrap();
                validate_thresholds(&generated).unwrap();
                assert_eq!(generated[8], budget * u64::from(days));
            }
        }
        for (budget, days) in [
            (0, 5),
            (1, 7),
            (5_000, 0),
            (5_000, 8),
            (MAX_DAILY_PRESS_BUDGET + 1, 1),
        ] {
            assert!(weekly_thresholds(budget, days).is_err());
        }
        let default = Progress::default();
        default.validate().unwrap();
        assert!(default.auto_cycle);
        assert_eq!(default.cycle_round, 1);
        assert!(
            default
                .themes
                .values()
                .all(|theme| theme.threshold_mode == ThresholdMode::Weekly)
        );
    }

    #[test]
    fn schema_four_rejects_missing_round_fields_and_inconsistent_round_or_weekly_state() {
        let valid = serde_json::to_value(Progress::default()).unwrap();
        for field in [
            "dailyPressBudget",
            "activeDaysPerWeek",
            "autoCycle",
            "cycleRound",
        ] {
            let mut value = valid.clone();
            value.as_object_mut().unwrap().remove(field);
            assert!(
                Progress::parse(&value.to_string()).is_err(),
                "missing {field}"
            );
        }
        for (field, bad) in [
            ("roundPresses", json!(1)),
            ("roundLevel", json!(0)),
            ("unlockedLevel", json!(0)),
            ("thresholdMode", json!("unknown")),
            ("thresholds", json!(LEGACY_THRESHOLDS)),
        ] {
            let mut value = valid.clone();
            value["themes"]["wizard"][field] = bad;
            assert!(
                Progress::parse(&value.to_string()).is_err(),
                "accepted {field}"
            );
        }
        for (field, bad) in [
            ("cycleRound", json!(0)),
            ("cycleRound", json!(MAX_SAFE_COUNT + 1)),
            ("activeDaysPerWeek", json!(8)),
            ("dailyPressBudget", json!(1)),
        ] {
            let mut value = valid.clone();
            value[field] = bad;
            assert!(
                Progress::parse(&value.to_string()).is_err(),
                "accepted {field}"
            );
        }
        let mut value = serde_json::to_value(progress_at(2_000)).unwrap();
        value["themes"]["wizard"]["roundLevel"] = json!(1);
        assert!(Progress::parse(&value.to_string()).is_err());
    }

    fn schema_three_fixture() -> String {
        let mut value = serde_json::to_value(Progress::default()).unwrap();
        value["schemaVersion"] = json!(3);
        for field in [
            "dailyPressBudget",
            "activeDaysPerWeek",
            "autoCycle",
            "cycleRound",
        ] {
            value.as_object_mut().unwrap().remove(field);
        }
        for theme in value["themes"].as_object_mut().unwrap().values_mut() {
            for field in ["roundPresses", "roundLevel", "thresholdMode"] {
                theme.as_object_mut().unwrap().remove(field);
            }
            theme["thresholds"] = json!(LEGACY_THRESHOLDS);
        }
        value["themes"]["wizard"]["presses"] = json!(20_000);
        value["themes"]["wizard"]["unlockedLevel"] = json!(4);
        value["themes"]["wizard"]["equippedLevel"] = json!(2);
        value["themes"]["emperor"]["presses"] = json!(500);
        value["themes"]["emperor"]["thresholds"] =
            json!([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]);
        value["themes"]["emperor"]["unlockedLevel"] = json!(9);
        value["themes"]["emperor"]["equippedLevel"] = json!(9);
        value["totalPresses"] = json!(20_500);
        value["outfitThemeId"] = json!("emperor");
        value["decorationsEnabled"] = json!(false);
        value.to_string()
    }

    #[test]
    fn schema_three_migration_replaces_only_legacy_recipe_and_keeps_permanent_collection_and_bytes()
    {
        let directory = TestDirectory::new();
        let original = schema_three_fixture();
        fs::write(directory.0.join("growth.json"), &original).unwrap();
        let mut state = GrowthInner::load(directory.0.clone());
        assert!(!state.save_blocked);
        assert!(state.dirty && state.save_requested);
        assert_eq!(state.progress.total_presses, 20_500);
        let wizard = &state.progress.themes["wizard"];
        assert_eq!(wizard.presses, 20_000);
        assert_eq!(wizard.round_presses, 20_000);
        assert_eq!(wizard.thresholds, THRESHOLDS);
        assert_eq!(wizard.threshold_mode, ThresholdMode::Weekly);
        assert_eq!(wizard.unlocked_level, 7);
        assert_eq!(wizard.round_level, 7);
        assert_eq!(wizard.equipped_level, 2);
        let emperor = &state.progress.themes["emperor"];
        assert_eq!(emperor.threshold_mode, ThresholdMode::Custom);
        assert_eq!(emperor.thresholds[8], 8_000);
        assert_eq!(emperor.presses, 500);
        assert_eq!(emperor.unlocked_level, 9);
        assert_eq!(emperor.round_level, 9);
        assert_eq!(emperor.equipped_level, 9);
        assert!(!state.progress.decorations_enabled);
        assert_eq!(state.progress.outfit_theme_id, "emperor");
        state.flush().unwrap();
        assert_eq!(
            fs::read_to_string(directory.0.join("growth.backup.json")).unwrap(),
            original
        );
        let archive = fs::read_dir(&directory.0)
            .unwrap()
            .filter_map(Result::ok)
            .find(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("growth.pre-migration-")
            })
            .unwrap();
        assert_eq!(fs::read_to_string(archive.path()).unwrap(), original);
        let mut invalid: serde_json::Value = serde_json::from_str(&original).unwrap();
        invalid["themes"].as_object_mut().unwrap().remove("emperor");
        assert!(Progress::parse(&invalid.to_string()).is_err());
    }

    #[test]
    fn weekly_plan_preserves_explicit_custom_recipe_and_restores_only_when_requested() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.set_thresholds("emperor", THRESHOLDS).unwrap();
        state.set_weekly_plan(6_000, 6).unwrap();
        assert_eq!(state.snapshot().weekly_target_presses, 36_000);
        assert_eq!(state.progress.themes["wizard"].thresholds[8], 36_000);
        assert_eq!(state.progress.themes["emperor"].thresholds, THRESHOLDS);
        assert_eq!(
            state.progress.themes["emperor"].threshold_mode,
            ThresholdMode::Custom
        );
        state.use_weekly_thresholds("emperor").unwrap();
        assert_eq!(state.progress.themes["emperor"].thresholds[8], 36_000);
        assert_eq!(
            state.progress.themes["emperor"].threshold_mode,
            ThresholdMode::Weekly
        );
        let reloaded = GrowthInner::load(directory.0.clone());
        assert_eq!(reloaded.progress.daily_press_budget, 6_000);
        assert_eq!(reloaded.progress.active_days_per_week, 6);
        assert!(state.use_weekly_thresholds("unknown").is_err());
    }

    #[test]
    fn weekly_plan_failure_preserves_budget_thresholds_cycle_and_notifications() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.flush().unwrap();
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        let before = serde_json::to_value(&state.progress).unwrap();
        assert!(state.set_weekly_plan(8, 1).is_err());
        assert_eq!(serde_json::to_value(&state.progress).unwrap(), before);
        assert!(state.pending_unlocks.is_empty());
        assert!(state.use_weekly_thresholds("wizard").is_err());
        assert_eq!(serde_json::to_value(&state.progress).unwrap(), before);
    }

    #[test]
    fn weekly_changes_keep_counts_and_never_reduce_round_or_collection_levels() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress.auto_cycle = false;
        set_theme_at(&mut state.progress, "wizard", 7_000);
        state.set_weekly_plan(2_000, 5).unwrap();
        assert_eq!(state.progress.active().round_level, 7);
        assert_eq!(state.progress.active().unlocked_level, 7);
        state.set_weekly_plan(8_000, 7).unwrap();
        assert_eq!(state.progress.active().round_presses, 7_000);
        assert_eq!(state.progress.active().presses, 7_000);
        assert_eq!(state.progress.active().round_level, 7);
        assert_eq!(state.progress.active().unlocked_level, 7);
        state.progress.validate().unwrap();
    }

    #[test]
    fn completing_theme_cycles_in_registry_order_skips_completed_and_synchronizes_wearing() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = short_cycle_progress();
        set_theme_at(&mut state.progress, "wizard", 7);
        set_theme_at(&mut state.progress, "astronaut", 8);
        set_theme_at(&mut state.progress, "pirate", 2);
        state.progress.auto_equip = false;
        state.progress.outfit_theme_id = "none".into();
        assert_eq!(state.process_key("KeyA", true), vec![9]);
        assert_eq!(
            state.progress.growth_theme_id, "wizard",
            "must wait for disk commit"
        );
        state.flush().unwrap();
        assert_eq!(state.progress.growth_theme_id, "pirate");
        assert_eq!(state.progress.outfit_theme_id, "pirate");
        assert_eq!(state.progress.active().equipped_level, 3);
        assert_eq!(state.progress.themes["wizard"].unlocked_level, 9);
        let event = state.take_persisted_unlocks().remove(0);
        assert_eq!(event.theme_id, "wizard");
        assert_eq!(event.levels, vec![9]);
        state.process_key("KeyA", false);
        state.process_key("KeyB", true);
        assert_eq!(state.progress.active().round_level, 4);
        assert_eq!(
            state.progress.active().equipped_level,
            3,
            "same-theme upgrades still respect autoEquip"
        );
    }

    #[test]
    fn disabled_cycle_stays_at_nine_and_reenable_advances_without_resetting_stats() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = short_cycle_progress();
        state.progress.auto_cycle = false;
        set_theme_at(&mut state.progress, "wizard", 7);
        state.process_key("KeyA", true);
        state.flush().unwrap();
        assert_eq!(state.progress.growth_theme_id, "wizard");
        assert_eq!(state.progress.active().round_level, 9);
        state.update_settings(GrowthSettings {
            auto_cycle: Some(true),
            ..Default::default()
        });
        state.flush().unwrap();
        assert_eq!(state.progress.growth_theme_id, "astronaut");
        assert_eq!(state.progress.total_presses, 8);
        assert_eq!(state.progress.themes["wizard"].presses, 8);
    }

    fn almost_finished_round() -> Progress {
        let mut progress = short_cycle_progress();
        for id in THEME_IDS {
            set_theme_at(&mut progress, id, if id == "emperor" { 7 } else { 8 });
        }
        progress.growth_theme_id = "emperor".into();
        progress.outfit_theme_id = "emperor".into();
        progress
    }

    #[test]
    fn all_twelve_completion_opens_new_round_keeps_collection_and_requires_fresh_training() {
        let directory = TestDirectory::new();
        let mut state = GrowthInner::load(directory.0.clone());
        state.progress = almost_finished_round();
        state.process_key("KeyA", true);
        state.flush().unwrap();
        assert_eq!(state.progress.cycle_round, 2);
        assert_eq!(state.progress.total_presses, 96);
        assert_eq!(state.progress.growth_theme_id, "wizard");
        assert_eq!(state.progress.outfit_theme_id, "wizard");
        assert_eq!(state.progress.active().equipped_level, 1);
        assert!(
            state
                .progress
                .themes
                .values()
                .all(|theme| theme.presses == 8
                    && theme.unlocked_level == 9
                    && theme.round_level == 1
                    && theme.round_presses == 0)
        );
        state.take_persisted_unlocks();
        state.flush().unwrap();
        assert_eq!(
            state.progress.cycle_round, 2,
            "permanent Lv9 must not cause another loop"
        );
        assert_eq!(state.progress.growth_theme_id, "wizard");
        state.equip_for_theme("emperor", 9).unwrap();
        assert_eq!(state.progress.growth_theme_id, "wizard");
        assert_eq!(state.progress.outfit_theme_id, "emperor");
        state.process_key("KeyA", false);
        for _ in 0..8 {
            state.process_key("KeyB", true);
            state.process_key("KeyB", false);
        }
        state.flush().unwrap();
        assert_eq!(state.progress.growth_theme_id, "astronaut");
        assert_eq!(state.progress.cycle_round, 2);
        assert_eq!(state.progress.themes["wizard"].presses, 16);
        assert_eq!(state.progress.themes["wizard"].round_presses, 8);
        assert!(
            state.take_persisted_unlocks().is_empty(),
            "old collection must not be issued twice"
        );
        let reloaded = GrowthInner::load(directory.0.clone());
        assert_eq!(reloaded.progress.cycle_round, 2);
        assert_eq!(reloaded.progress.growth_theme_id, "astronaut");
        assert_eq!(reloaded.progress.active().round_level, 1);
        assert_eq!(reloaded.progress.active().unlocked_level, 9);
    }

    #[test]
    fn failed_cycle_save_keeps_route_and_queued_events_retain_old_theme_after_retry() {
        let directory = TestDirectory::new();
        let mut initial = short_cycle_progress();
        set_theme_at(&mut initial, "wizard", 7);
        save_progress(&directory.0, &initial).unwrap();
        fs::create_dir(directory.0.join("growth.backup.json")).unwrap();
        let service = test_service(directory.0.clone());
        let mut state = service.lock();
        service.enqueue_input("KeyA".into(), true);
        service.enqueue_input("KeyA".into(), false);
        service.drain(&mut state);
        assert!(state.flush().is_err());
        service.sync_input_theme(&state);
        assert_eq!(state.progress.growth_theme_id, "wizard");
        assert_eq!(service.input_route.lock().unwrap().theme_id, "wizard");
        service.enqueue_input("KeyB".into(), true);
        service.enqueue_input("KeyB".into(), false);
        fs::remove_dir(directory.0.join("growth.backup.json")).unwrap();
        state.flush().unwrap();
        service.sync_input_theme(&state);
        service.enqueue_input("KeyC".into(), true);
        service.enqueue_input("KeyC".into(), false);
        service.drain(&mut state);
        assert_eq!(state.progress.themes["wizard"].presses, 9);
        assert_eq!(state.progress.themes["astronaut"].presses, 1);
        assert_eq!(state.progress.total_presses, 10);
        assert!(state.held_keys.is_empty());
    }

    #[test]
    fn events_queued_during_round_commit_keep_history_but_do_not_leak_into_new_round() {
        let directory = TestDirectory::new();
        save_progress(&directory.0, &almost_finished_round()).unwrap();
        let service = test_service(directory.0.clone());
        let mut state = service.lock();
        service.enqueue_input("KeyA".into(), true);
        service.enqueue_input("KeyA".into(), false);
        service.drain(&mut state);
        service.enqueue_input("KeyB".into(), true);
        service.enqueue_input("KeyB".into(), false);
        state.flush().unwrap();
        service.sync_input_theme(&state);
        assert_eq!(service.input_route.lock().unwrap().cycle_round, 2);
        service.enqueue_input("KeyC".into(), true);
        service.enqueue_input("KeyC".into(), false);
        service.drain(&mut state);
        assert_eq!(state.progress.total_presses, 98);
        assert_eq!(state.progress.themes["emperor"].presses, 9);
        assert_eq!(state.progress.themes["emperor"].round_presses, 0);
        assert_eq!(state.progress.themes["wizard"].presses, 9);
        assert_eq!(state.progress.themes["wizard"].round_presses, 1);
        assert_eq!(state.progress.themes["wizard"].round_level, 2);
        assert!(state.held_keys.is_empty());
        state.progress.validate().unwrap();
    }

    use serde_json::json;
}
