use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

#[derive(Default)]
pub struct AppLifecycleState {
    allow_exit: AtomicBool,
    listener_count: AtomicUsize,
}

impl AppLifecycleState {
    pub fn allow_exit(&self) {
        self.allow_exit.store(true, Ordering::SeqCst);
    }

    pub fn should_intercept_exit(&self) -> bool {
        self.listener_count.load(Ordering::SeqCst) > 0 && !self.allow_exit.load(Ordering::SeqCst)
    }
}

#[tauri::command]
pub fn register_exit_listener(state: tauri::State<'_, AppLifecycleState>) {
    state.listener_count.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn unregister_exit_listener(state: tauri::State<'_, AppLifecycleState>) {
    let _ = state
        .listener_count
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |count| {
            Some(count.saturating_sub(1))
        });
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle, state: tauri::State<'_, AppLifecycleState>) {
    state.allow_exit();
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exit_is_only_intercepted_while_the_frontend_listener_is_ready() {
        let state = AppLifecycleState::default();
        assert!(!state.should_intercept_exit());

        state.listener_count.store(2, Ordering::SeqCst);
        assert!(state.should_intercept_exit());

        state.listener_count.fetch_sub(1, Ordering::SeqCst);
        assert!(state.should_intercept_exit());

        state.allow_exit();
        assert!(!state.should_intercept_exit());
    }
}
