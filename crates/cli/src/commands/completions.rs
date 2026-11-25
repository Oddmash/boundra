use crate::cli::HELP_COMMANDS;
use std::fmt::Write;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Shell {
    Bash,
    Zsh,
    Fish,
}

impl Shell {
    pub(crate) fn parse(value: &str) -> Result<Self, String> {
        match value {
            "bash" => Ok(Self::Bash),
            "zsh" => Ok(Self::Zsh),
            "fish" => Ok(Self::Fish),
            _ => Err(format!(
                "unsupported shell: {value}; expected bash, zsh or fish"
            )),
        }
    }
}

fn definitions() -> Vec<(&'static str, Vec<&'static str>)> {
    HELP_COMMANDS
        .iter()
        .map(|usage| {
            let mut tokens = usage.split_whitespace();
            let name = tokens.next().expect("help entry has a command");
            let mut options = Vec::new();
            for (index, token) in tokens.enumerate() {
                let token = token.trim_matches(['[', ']']);
                if token.starts_with("--") {
                    options.push(token);
                } else if index == 0 && token.contains('|') {
                    options.extend(token.split('|'));
                }
            }
            (name, options)
        })
        .collect()
}

fn render(shell: Shell) -> String {
    let definitions = definitions();
    let names = definitions
        .iter()
        .map(|(name, _)| *name)
        .collect::<Vec<_>>()
        .join(" ");
    let mut output = String::new();
    match shell {
        Shell::Bash => {
            output.push_str(
                "_boundra_complete() {\n  local cur choices\n  cur=\"${COMP_WORDS[COMP_CWORD]}\"\n",
            );
            let _ = writeln!(output, "  if (( COMP_CWORD == 1 )); then choices='{names}'; else\n    case \"${{COMP_WORDS[1]}}\" in");
            for (name, options) in &definitions {
                let _ = writeln!(output, "      {name}) choices='{}' ;;", options.join(" "));
            }
            output.push_str("    esac\n  fi\n  COMPREPLY=( $(compgen -W \"$choices\" -- \"$cur\") )\n}\ncomplete -o default -F _boundra_complete boundra\n");
        }
        Shell::Zsh => {
            output.push_str("#compdef boundra\n_boundra() {\n  local -a choices\n");
            let _ = writeln!(output, "  if (( CURRENT == 2 )); then choices=({names}); else\n    case \"${{words[2]}}\" in");
            for (name, options) in &definitions {
                let _ = writeln!(output, "      {name}) choices=({}) ;;", options.join(" "));
            }
            output.push_str("    esac\n  fi\n  compadd -- \"${choices[@]}\"\n}\n_boundra\n");
        }
        Shell::Fish => {
            let _ = writeln!(
                output,
                "complete -c boundra -n '__fish_use_subcommand' -a '{names}'"
            );
            for (name, options) in &definitions {
                for option in options {
                    if let Some(flag) = option.strip_prefix("--") {
                        let _ = writeln!(output, "complete -c boundra -n '__fish_seen_subcommand_from {name}' -l {flag} -r");
                    } else {
                        let _ = writeln!(output, "complete -c boundra -n '__fish_seen_subcommand_from {name}' -a '{option}'");
                    }
                }
            }
        }
    }
    output
}

pub(crate) fn run(shell: Shell) -> i32 {
    print!("{}", render(shell));
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn completion_definitions_follow_help() {
        for shell in [Shell::Bash, Shell::Zsh, Shell::Fish] {
            let script = render(shell);
            for (name, options) in definitions() {
                assert!(script.contains(name));
                for option in options {
                    assert!(script.contains(option.trim_start_matches("--")));
                }
            }
        }
        assert!(Shell::parse("unknown").is_err());
    }
}
