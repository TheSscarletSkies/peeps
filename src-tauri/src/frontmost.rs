//! The name of the app in front, and nothing else: no window titles, no content.

/// None when it can't tell, or on systems it doesn't know how to ask.
pub fn app() -> Option<String> {
    let name = imp::app()?;
    let name = name.trim();
    (!name.is_empty()).then(|| name.to_owned())
}

// AppKit has no safe Rust binding for this, so it asks NSWorkspace directly.
#[cfg(target_os = "macos")]
#[allow(unsafe_code)]
mod imp {
    use std::ffi::{c_char, CStr};

    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};

    pub fn app() -> Option<String> {
        unsafe {
            let workspace: *mut AnyObject = msg_send![class!(NSWorkspace), sharedWorkspace];
            let front: *mut AnyObject = msg_send![workspace.as_ref()?, frontmostApplication];
            let name: *mut AnyObject = msg_send![front.as_ref()?, localizedName];
            let text: *const c_char = msg_send![name.as_ref()?, UTF8String];
            if text.is_null() {
                return None;
            }
            Some(CStr::from_ptr(text).to_string_lossy().into_owned())
        }
    }
}

// The Win32 calls are only reachable through raw bindings.
#[cfg(windows)]
#[allow(unsafe_code)]
mod imp {
    use std::path::Path;

    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId,
    };

    pub fn app() -> Option<String> {
        unsafe {
            let window = GetForegroundWindow();
            if window.is_null() {
                return None;
            }
            let mut pid = 0u32;
            GetWindowThreadProcessId(window, &mut pid);
            if pid == 0 {
                return None;
            }
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process.is_null() {
                return None;
            }
            let mut buffer = [0u16; 1024];
            let mut length = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                buffer.as_mut_ptr(),
                &mut length,
            );
            CloseHandle(process);
            if ok == 0 {
                return None;
            }
            let path = String::from_utf16_lossy(&buffer[..length as usize]);
            Path::new(&path)
                .file_stem()
                .map(|stem| stem.to_string_lossy().into_owned())
        }
    }
}

#[cfg(not(any(target_os = "macos", windows)))]
mod imp {
    pub fn app() -> Option<String> {
        None
    }
}
