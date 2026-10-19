use tauri::{LogicalSize, PhysicalPosition, WebviewWindow};

pub const LABEL: &str = "main";
pub const HOME: &str = "home";

const COLLAPSED: LogicalSize<f64> = LogicalSize::new(360.0, 48.0);
const EXPANDED: LogicalSize<f64> = LogicalSize::new(640.0, 440.0);

/// Sizes the window and pins it to the top centre of its screen, under the notch.
pub fn dock(window: &WebviewWindow, expanded: bool) -> tauri::Result<()> {
    let size = if expanded { EXPANDED } else { COLLAPSED };
    window.set_size(size)?;
    let Some(monitor) = window.current_monitor()? else {
        return Ok(());
    };
    // The resize lands asynchronously on some platforms, so centre on the requested width.
    let width = (size.width * monitor.scale_factor()).round() as i32;
    let screen = monitor.size().width as i32;
    let origin = monitor.position();
    window.set_position(PhysicalPosition::new(
        origin.x + (screen - width) / 2,
        origin.y,
    ))
}

/// Shows the peeps window and brings it to the front.
pub fn show_home(window: &WebviewWindow) -> tauri::Result<()> {
    window.show()?;
    window.unminimize()?;
    window.set_focus()
}
