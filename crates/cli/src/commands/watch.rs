use std::io::{self, Write};
use std::path::PathBuf;
use std::process::{Command, Output};
use std::time::Duration;

use crate::output::{print_error, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct WatchOptions {
    pub(crate) root: PathBuf,
    pub(crate) format: OutputFormat,
    pub(crate) interval_ms: u64,
    pub(crate) once: bool,
    pub(crate) min_domains: Option<usize>,
}

fn scan(executable: &PathBuf, options: &WatchOptions) -> io::Result<Output> {
    let mut command = Command::new(executable);
    command
        .arg("check-boundaries")
        .arg("--root")
        .arg(&options.root)
        .arg("--format")
        .arg(match options.format {
            OutputFormat::Text => "text",
            OutputFormat::Json => "json",
        });
    if let Some(minimum) = options.min_domains {
        command.arg("--min-domains").arg(minimum.to_string());
    }
    command.output()
}

fn emit(options: &WatchOptions, output: &Output, code: i32) -> io::Result<()> {
    let stdout = io::stdout();
    let mut writer = stdout.lock();
    match options.format {
        OutputFormat::Text => {
            writeln!(writer, "watch: scan (exit code {code})")?;
            writer.write_all(&output.stdout)?;
            writer.write_all(&output.stderr)?;
        }
        OutputFormat::Json => {
            let report = serde_json::from_slice::<serde_json::Value>(&output.stdout)
                .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
            let event = serde_json::json!({"event":"scan","exit_code":code,"report":report,"meta":{"command":"watch"}});
            serde_json::to_writer(&mut writer, &event)?;
            writeln!(writer)?;
        }
    }
    writer.flush()
}

pub(crate) fn run(options: &WatchOptions) -> i32 {
    let executable = match std::env::current_exe() {
        Ok(path) => path,
        Err(error) => return report_error(options, error),
    };
    let mut previous: Option<(i32, Vec<u8>, Vec<u8>)> = None;
    loop {
        let output = match scan(&executable, options) {
            Ok(output) => output,
            Err(error) => return report_error(options, error),
        };
        let code = output.status.code().unwrap_or(3);
        let current = (code, output.stdout.clone(), output.stderr.clone());
        if previous.as_ref() != Some(&current) {
            if let Err(error) = emit(options, &output, code) {
                if error.kind() == io::ErrorKind::BrokenPipe {
                    return 0;
                }
                return report_error(options, error);
            }
            previous = Some(current);
        }
        if options.once {
            return code;
        }
        std::thread::sleep(Duration::from_millis(options.interval_ms));
    }
}

fn report_error(options: &WatchOptions, error: io::Error) -> i32 {
    let diagnostic = CliDiagnostic::new(
        "WATCH-001",
        format!("watch failed: {error}"),
        "verify the local Boundra executable and workspace, then retry",
    );
    match options.format {
        OutputFormat::Text => print_error(&diagnostic),
        OutputFormat::Json => println!(
            "{}",
            serde_json::json!({"event":"error","exit_code":3,"report":{"status":"error","errors":[diagnostic]},"meta":{"command":"watch"}})
        ),
    }
    3
}
