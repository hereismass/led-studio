use serde::Serialize;
use std::{
    collections::HashMap,
    fs::{self, File},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

const MAX_PROJECT_FILE_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectFileErrorCode {
    FileTooLarge,
    InvalidHandle,
    PathUnavailable,
    ReadFailed,
    RegistryUnavailable,
    WriteFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileError {
    code: ProjectFileErrorCode,
    message: String,
}

impl ProjectFileError {
    fn new(code: ProjectFileErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFileReference {
    file_name: String,
    handle: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenedProjectFile {
    contents: String,
    file_name: String,
    handle: String,
}

#[derive(Default)]
pub struct ProjectFileRegistry {
    files: Mutex<HashMap<String, PathBuf>>,
}

impl ProjectFileRegistry {
    fn register(&self, path: PathBuf) -> Result<ProjectFileReference, ProjectFileError> {
        let handle = Uuid::new_v4().to_string();
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("LED Studio project")
            .to_owned();
        self.files
            .lock()
            .map_err(|_| {
                ProjectFileError::new(
                    ProjectFileErrorCode::RegistryUnavailable,
                    "The project file registry is unavailable.",
                )
            })?
            .insert(handle.clone(), path);

        Ok(ProjectFileReference { file_name, handle })
    }

    fn resolve(&self, handle: &str) -> Result<PathBuf, ProjectFileError> {
        self.files
            .lock()
            .map_err(|_| {
                ProjectFileError::new(
                    ProjectFileErrorCode::RegistryUnavailable,
                    "The project file registry is unavailable.",
                )
            })?
            .get(handle)
            .cloned()
            .ok_or_else(|| {
                ProjectFileError::new(
                    ProjectFileErrorCode::InvalidHandle,
                    "The project file handle is no longer valid.",
                )
            })
    }

    fn release(&self, handle: &str) -> Result<(), ProjectFileError> {
        let removed = self
            .files
            .lock()
            .map_err(|_| {
                ProjectFileError::new(
                    ProjectFileErrorCode::RegistryUnavailable,
                    "The project file registry is unavailable.",
                )
            })?
            .remove(handle);
        if removed.is_none() {
            return Err(ProjectFileError::new(
                ProjectFileErrorCode::InvalidHandle,
                "The project file handle is no longer valid.",
            ));
        }
        Ok(())
    }
}

fn suggested_project_file_name(project_name: &str) -> String {
    let mut stem = String::new();
    let mut pending_dash = false;

    for character in project_name.to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            if pending_dash && !stem.is_empty() {
                stem.push('-');
            }
            stem.push(character);
            pending_dash = false;
        } else {
            pending_dash = true;
        }
    }

    format!(
        "{}.ledstudio",
        if stem.is_empty() {
            "untitled-project"
        } else {
            &stem
        }
    )
}

fn ensure_project_extension(mut path: PathBuf) -> PathBuf {
    let has_project_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension == "ledstudio");

    if !has_project_extension {
        path.set_extension("ledstudio");
    }

    path
}

fn atomic_write(path: &Path, contents: &[u8]) -> io::Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temporary_file = tempfile::NamedTempFile::new_in(parent)?;

    if let Ok(metadata) = fs::metadata(path) {
        temporary_file
            .as_file()
            .set_permissions(metadata.permissions())?;
    }

    temporary_file.write_all(contents)?;
    temporary_file.as_file_mut().sync_all()?;
    temporary_file.persist(path).map_err(|error| error.error)?;

    #[cfg(unix)]
    File::open(parent)?.sync_all()?;

    Ok(())
}

fn read_project_contents(path: &Path) -> Result<String, ProjectFileError> {
    let metadata = fs::metadata(path).map_err(|error| {
        ProjectFileError::new(
            ProjectFileErrorCode::ReadFailed,
            format!("The selected project could not be inspected: {error}"),
        )
    })?;
    if metadata.len() > MAX_PROJECT_FILE_BYTES {
        return Err(ProjectFileError::new(
            ProjectFileErrorCode::FileTooLarge,
            "The selected project is larger than the 32 MiB limit.",
        ));
    }
    fs::read_to_string(path).map_err(|error| {
        ProjectFileError::new(
            ProjectFileErrorCode::ReadFailed,
            format!("The selected project could not be read: {error}"),
        )
    })
}

fn write_project_contents(path: &Path, contents: String) -> Result<(), ProjectFileError> {
    if contents.len() as u64 > MAX_PROJECT_FILE_BYTES {
        return Err(ProjectFileError::new(
            ProjectFileErrorCode::FileTooLarge,
            "The project is larger than the 32 MiB limit.",
        ));
    }
    atomic_write(path, contents.as_bytes()).map_err(|error| {
        ProjectFileError::new(
            ProjectFileErrorCode::WriteFailed,
            format!("The project could not be saved: {error}"),
        )
    })
}

#[tauri::command]
pub async fn open_project(
    app: tauri::AppHandle,
    registry: tauri::State<'_, ProjectFileRegistry>,
) -> Result<Option<OpenedProjectFile>, ProjectFileError> {
    let selected_path = app
        .dialog()
        .file()
        .add_filter("LED Studio project", &["ledstudio", "json"])
        .blocking_pick_file();
    let Some(selected_path) = selected_path else {
        return Ok(None);
    };
    let path = selected_path.into_path().map_err(|error| {
        ProjectFileError::new(
            ProjectFileErrorCode::PathUnavailable,
            format!("The selected project path is unavailable: {error}"),
        )
    })?;
    let read_path = path.clone();
    let contents = tauri::async_runtime::spawn_blocking(move || read_project_contents(&read_path))
        .await
        .map_err(|error| {
            ProjectFileError::new(
                ProjectFileErrorCode::ReadFailed,
                format!("The selected project read task failed: {error}"),
            )
        })??;
    let reference = registry.register(path)?;

    Ok(Some(OpenedProjectFile {
        contents,
        file_name: reference.file_name,
        handle: reference.handle,
    }))
}

#[tauri::command]
pub async fn save_project(
    handle: String,
    contents: String,
    registry: tauri::State<'_, ProjectFileRegistry>,
) -> Result<(), ProjectFileError> {
    let path = registry.resolve(&handle)?;
    tauri::async_runtime::spawn_blocking(move || write_project_contents(&path, contents))
        .await
        .map_err(|error| {
            ProjectFileError::new(
                ProjectFileErrorCode::WriteFailed,
                format!("The project write task failed: {error}"),
            )
        })?
}

#[tauri::command]
pub async fn save_project_as(
    app: tauri::AppHandle,
    suggested_name: String,
    contents: String,
    registry: tauri::State<'_, ProjectFileRegistry>,
) -> Result<Option<ProjectFileReference>, ProjectFileError> {
    let selected_path = app
        .dialog()
        .file()
        .set_title("Save LED Studio project")
        .set_file_name(suggested_project_file_name(&suggested_name))
        .add_filter("LED Studio project", &["ledstudio"])
        .blocking_save_file();
    let Some(selected_path) = selected_path else {
        return Ok(None);
    };
    let path = ensure_project_extension(selected_path.into_path().map_err(|error| {
        ProjectFileError::new(
            ProjectFileErrorCode::PathUnavailable,
            format!("The selected project path is unavailable: {error}"),
        )
    })?);

    let write_path = path.clone();
    tauri::async_runtime::spawn_blocking(move || write_project_contents(&write_path, contents))
        .await
        .map_err(|error| {
            ProjectFileError::new(
                ProjectFileErrorCode::WriteFailed,
                format!("The project write task failed: {error}"),
            )
        })??;

    registry.register(path).map(Some)
}

#[tauri::command]
pub fn release_project_file(
    handle: String,
    registry: tauri::State<'_, ProjectFileRegistry>,
) -> Result<(), ProjectFileError> {
    registry.release(&handle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suggests_safe_project_file_names() {
        assert_eq!(
            suggested_project_file_name("My Lighting Show"),
            "my-lighting-show.ledstudio"
        );
        assert_eq!(
            suggested_project_file_name("  already---spaced  "),
            "already-spaced.ledstudio"
        );
        assert_eq!(
            suggested_project_file_name("🎸"),
            "untitled-project.ledstudio"
        );
    }

    #[test]
    fn enforces_the_project_extension() {
        assert_eq!(
            ensure_project_extension(PathBuf::from("show.json")),
            PathBuf::from("show.ledstudio")
        );
        assert_eq!(
            ensure_project_extension(PathBuf::from("show.LEDSTUDIO")),
            PathBuf::from("show.ledstudio")
        );
    }

    #[test]
    fn atomically_creates_and_replaces_project_files() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("show.ledstudio");

        atomic_write(&path, b"first").expect("initial write");
        assert_eq!(fs::read_to_string(&path).unwrap(), "first");

        atomic_write(&path, b"second").expect("replacement write");
        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn a_failed_write_does_not_change_an_existing_project() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("show.ledstudio");
        fs::write(&path, "original").unwrap();
        let missing_parent = directory.path().join("missing").join("show.ledstudio");

        assert!(atomic_write(&missing_parent, b"replacement").is_err());
        assert_eq!(fs::read_to_string(path).unwrap(), "original");
    }

    #[test]
    fn rejects_unknown_file_handles() {
        let registry = ProjectFileRegistry::default();
        assert!(registry.resolve("unknown").is_err());
    }

    #[test]
    fn releases_registered_file_handles() {
        let registry = ProjectFileRegistry::default();
        let reference = registry
            .register(PathBuf::from("show.ledstudio"))
            .expect("registered handle");
        assert!(registry.resolve(&reference.handle).is_ok());
        registry
            .release(&reference.handle)
            .expect("released handle");
        assert!(registry.resolve(&reference.handle).is_err());
    }

    #[test]
    fn rejects_projects_larger_than_the_file_limit() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("oversized.ledstudio");
        let file = File::create(&path).expect("project file");
        file.set_len(MAX_PROJECT_FILE_BYTES + 1)
            .expect("sparse oversized file");

        let error = read_project_contents(&path).expect_err("oversized project rejected");
        assert_eq!(error.code, ProjectFileErrorCode::FileTooLarge);
    }

    #[test]
    fn refuses_to_write_projects_larger_than_the_file_limit() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let path = directory.path().join("oversized.ledstudio");
        let contents = "x".repeat((MAX_PROJECT_FILE_BYTES + 1) as usize);

        let error =
            write_project_contents(&path, contents).expect_err("oversized project rejected");
        assert_eq!(error.code, ProjectFileErrorCode::FileTooLarge);
        assert!(!path.exists());
    }
}
