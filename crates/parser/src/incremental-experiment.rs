use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::{fs, io};

use super::{
    collect_ts_like_files, extract_imports_from_content, source_for_import_scan, ImportRecord,
    ImportScanReport, ScanOptions,
};

#[derive(Default)]
pub struct ExperimentalImportCache {
    root: Option<PathBuf>,
    entries: BTreeMap<String, (String, Vec<ImportRecord>)>,
}

impl ExperimentalImportCache {
    pub fn scan(&mut self, root: &Path, options: &ScanOptions) -> io::Result<ImportScanReport> {
        let mut files = Vec::new();
        collect_ts_like_files(root, root, options, &mut files)?;
        files.sort_unstable();
        let mut next = BTreeMap::new();
        let mut imports = Vec::new();
        let mut scanned_files = Vec::with_capacity(files.len());
        for file in files {
            let content = fs::read_to_string(&file)?;
            let relative = file
                .strip_prefix(root)
                .unwrap_or(&file)
                .to_string_lossy()
                .replace('\\', "/");
            let cached = if self.root.as_deref() == Some(root) {
                self.entries.get(&relative)
            } else {
                None
            };
            let records = match cached {
                Some((previous, records)) if previous == &content => records.clone(),
                _ => {
                    let source_dir = Path::new(&relative)
                        .parent()
                        .map(|path| path.to_string_lossy().replace('\\', "/"))
                        .unwrap_or_default();
                    extract_imports_from_content(&source_for_import_scan(&relative, &content))
                        .into_iter()
                        .map(|(line, import_path)| ImportRecord {
                            source_file: relative.clone(),
                            source_dir: source_dir.clone(),
                            line,
                            import_path,
                        })
                        .collect()
                }
            };
            imports.extend(records.iter().cloned());
            scanned_files.push(relative.clone());
            next.insert(relative, (content, records));
        }
        self.entries = next;
        self.root = Some(root.to_path_buf());
        Ok(ImportScanReport {
            scanned_file_count: scanned_files.len(),
            scanned_files,
            imports,
        })
    }
}
