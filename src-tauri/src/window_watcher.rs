/// "메시지 전송" 창을 주기적으로 감시하고
/// 창이 보이면 우리 창을 옆에 붙이고, 없으면 숨깁니다.
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct WindowRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

pub fn start_watcher(app: AppHandle) {
    let mut was_visible = false;
    let mut last_rect: Option<WindowRect> = None;

    // 가변 폴링 주기용 변수
    let fast_poll = 20; // 움직일 때: 20ms 간격 (매우 부드러움)
    let slow_poll = 200; // 멈췄을 때: 200ms 간격 (자원 절약)
    let mut current_sleep_ms = slow_poll;
    let mut idle_count = 0;

    loop {
        std::thread::sleep(Duration::from_millis(current_sleep_ms));

        match find_target_window() {
            Some(rect) => {
                if !was_visible {
                    was_visible = true;
                    current_sleep_ms = fast_poll; // 처음 나타났을 땐 빠르게
                    idle_count = 0;
                    let _ = app.emit("target-window-found", &rect);
                } else {
                    // 창이 움직였는지 확인
                    if let Some(ref last) = last_rect {
                        if last != &rect {
                            // 움직이는 중이라면 폴링 속도 최대화
                            current_sleep_ms = fast_poll;
                            idle_count = 0;
                            let _ = app.emit("target-window-moved", &rect);
                        } else {
                            // 안 움직이고 있다면
                            idle_count += 1;
                            // 약 0.5초(20ms * 25번) 이상 안 움직이면 다시 휴식 상태
                            if idle_count > 25 {
                                current_sleep_ms = slow_poll;
                            }
                        }
                    }
                }

                last_rect = Some(rect.clone());
                position_our_window(&app, &rect);
            }
            None => {
                if was_visible {
                    was_visible = false;
                    current_sleep_ms = slow_poll;
                    last_rect = None;
                    let _ = app.emit("target-window-lost", ());
                    hide_our_window(&app);
                }
            }
        }
    }
}

// ─── Windows 구현 ───────────────────────────────────────────
#[cfg(target_os = "windows")]
fn find_target_window() -> Option<WindowRect> {
    use windows::Win32::{
        Foundation::{BOOL, HWND, LPARAM, RECT},
        UI::WindowsAndMessaging::{
            EnumWindows, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, IsWindowVisible,
        },
    };

    struct Ctx {
        result: Option<WindowRect>,
    }

    unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let ctx = &mut *(lparam.0 as *mut Ctx);

        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return BOOL(1);
        }
        let mut buf = vec![0u16; (len + 1) as usize];
        let written = GetWindowTextW(hwnd, &mut buf);
        if written == 0 {
            return BOOL(1);
        }
        let title = String::from_utf16_lossy(&buf[..written as usize]);
        if title.contains("메시지 전송") {
            let mut rect = RECT::default();
            if GetWindowRect(hwnd, &mut rect).is_ok() {
                ctx.result = Some(WindowRect {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                });
            }
            return BOOL(0); // 찾았으면 중지
        }
        BOOL(1)
    }

    let mut ctx = Ctx { result: None };
    unsafe {
        let _ = EnumWindows(Some(callback), LPARAM(&mut ctx as *mut Ctx as isize));
    }
    ctx.result
}

// ─── 비-Windows 구현 (컴파일 오류 방지) ────────────────────
#[cfg(not(target_os = "windows"))]
fn find_target_window() -> Option<WindowRect> {
    None
}

// ─── 창 위치 조정 ──────────────────────────────────────────
fn position_our_window(app: &AppHandle, rect: &WindowRect) {
    if let Some(win) = app.get_webview_window("main") {
        let our_width = 420i32;

        let mut x = rect.right + 5;
        let y = rect.top;

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN};
            let screen_w = unsafe { GetSystemMetrics(SM_CXSCREEN) };
            if x + our_width > screen_w {
                x = rect.left - our_width - 5;
            }
            if x < 0 {
                x = rect.left;
            }
        }

        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
        let _ = win.show();
    }
}

fn hide_our_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}
