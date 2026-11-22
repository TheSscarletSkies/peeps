use std::io;

use interprocess::local_socket::{
    GenericFilePath, GenericNamespaced, Name, NameType, ToFsName, ToNsName,
};

use crate::paths;

const SOCKET: &str = "peeps.sock";

/// Whether the socket has a name of its own: a named pipe on Windows, the abstract namespace on
/// Linux. Elsewhere a "namespaced" name is only a file in /tmp, which sandboxes (such as an
/// agent's) can refuse to reach, so the Mac uses a file in peeps' own folder instead.
fn namespaced() -> bool {
    cfg!(any(windows, target_os = "linux")) && GenericNamespaced::is_supported()
}

/// The local socket the app listens on: a name of its own where there is one, otherwise a file in
/// the data directory.
pub fn socket_name() -> io::Result<Name<'static>> {
    if namespaced() {
        SOCKET.to_ns_name::<GenericNamespaced>()
    } else {
        paths::data_dir()
            .join(SOCKET)
            .to_fs_name::<GenericFilePath>()
    }
}

/// Removes a socket file left behind by a crashed app. A no-op for abstract names.
pub fn clear_stale_socket() -> io::Result<()> {
    if namespaced() {
        return Ok(());
    }
    match std::fs::remove_file(paths::data_dir().join(SOCKET)) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}
