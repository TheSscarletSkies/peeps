use serde::Serialize;
use tauri::WebviewWindow;

pub const LABEL: &str = "main";
pub const HOME: &str = "home";

/// The strip the pets live in: the menu bar height, and the width of the camera notch if there is one.
#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Notch {
    pub width: f64,
    pub height: f64,
}

/// Sizes the window and pins it to the top centre of the main screen, over the menu bar.
pub fn dock(window: &WebviewWindow, width: f64, height: f64) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let target = window.clone();
        window.run_on_main_thread(move || mac::place(&target, width, height))
    }
    #[cfg(not(target_os = "macos"))]
    {
        window.set_size(tauri::LogicalSize::new(width, height))?;
        let Some(monitor) = window.primary_monitor()?.or(window.current_monitor()?) else {
            return Ok(());
        };
        let scale = monitor.scale_factor();
        let origin = monitor.position().to_logical::<f64>(scale);
        let screen = monitor.size().to_logical::<f64>(scale);
        window.set_position(tauri::LogicalPosition::new(
            origin.x + (screen.width - width) / 2.0,
            origin.y,
        ))
    }
}

pub fn notch() -> Notch {
    #[cfg(target_os = "macos")]
    {
        mac::notch()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Notch::default()
    }
}

/// Shows the peeps window and brings it to the front.
pub fn show_home(window: &WebviewWindow) -> tauri::Result<()> {
    window.show()?;
    window.unminimize()?;
    window.set_focus()
}

// AppKit has no safe Rust binding for window levels or the notch, so this module talks to it directly.
#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
mod mac {
    use objc2::encode::{Encode, Encoding};
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send, sel};
    use tauri::WebviewWindow;

    use super::Notch;

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSPoint {
        x: f64,
        y: f64,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSSize {
        width: f64,
        height: f64,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct NSRect {
        origin: NSPoint,
        size: NSSize,
    }

    unsafe impl Encode for NSPoint {
        const ENCODING: Encoding = Encoding::Struct("CGPoint", &[f64::ENCODING, f64::ENCODING]);
    }

    unsafe impl Encode for NSSize {
        const ENCODING: Encoding = Encoding::Struct("CGSize", &[f64::ENCODING, f64::ENCODING]);
    }

    unsafe impl Encode for NSRect {
        const ENCODING: Encoding =
            Encoding::Struct("CGRect", &[NSPoint::ENCODING, NSSize::ENCODING]);
    }

    /// Above the menu bar, like the system's own notch apps, so the pets never cover a window.
    const LEVEL: isize = 27;
    /// Every space, never moved by Mission Control, skipped by Cmd-`, shown over full-screen apps.
    const BEHAVIOUR: usize = (1 << 0) | (1 << 4) | (1 << 6) | (1 << 8);

    fn main_screen() -> Option<&'static AnyObject> {
        // The first screen is the one with the menu bar, which is where the notch is.
        unsafe {
            let screens: *mut AnyObject = msg_send![class!(NSScreen), screens];
            let first: *mut AnyObject = msg_send![screens, firstObject];
            first.as_ref()
        }
    }

    pub fn notch() -> Notch {
        let Some(screen) = main_screen() else {
            return Notch::default();
        };
        unsafe {
            let frame: NSRect = msg_send![screen, frame];
            let visible: NSRect = msg_send![screen, visibleFrame];
            let height =
                (frame.origin.y + frame.size.height) - (visible.origin.y + visible.size.height);
            let has_areas: bool = msg_send![screen, respondsToSelector: sel!(auxiliaryTopLeftArea)];
            let width = if has_areas {
                let left: NSRect = msg_send![screen, auxiliaryTopLeftArea];
                let right: NSRect = msg_send![screen, auxiliaryTopRightArea];
                if left.size.width > 0.0 && right.size.width > 0.0 {
                    frame.size.width - left.size.width - right.size.width
                } else {
                    0.0
                }
            } else {
                0.0
            };
            Notch {
                width,
                height: height.max(24.0),
            }
        }
    }

    pub fn place(window: &WebviewWindow, width: f64, height: f64) {
        let (Some(screen), Ok(handle)) = (main_screen(), window.ns_window()) else {
            return;
        };
        unsafe {
            let ns = &*(handle as *mut AnyObject);
            let frame: NSRect = msg_send![screen, frame];
            let rect = NSRect {
                origin: NSPoint {
                    x: frame.origin.x + (frame.size.width - width) / 2.0,
                    y: frame.origin.y + frame.size.height - height,
                },
                size: NSSize { width, height },
            };
            let _: () = msg_send![ns, setLevel: LEVEL];
            let _: () = msg_send![ns, setCollectionBehavior: BEHAVIOUR];
            let _: () = msg_send![ns, setFrame: rect, display: true];
        }
    }
}
