// --- GIT STATE ENGINE ---
let gitState = {
    isInitialized: false,
    workspace: [], // Untracked or modified files
    staging: [],   // Files ready to commit
    commits: []    // Saved history
};

// DOM Elements
const visContainer = document.getElementById('visualizer');
const boxWorkspace = document.getElementById('box-workspace');
const boxStaging = document.getElementById('box-staging');
const boxRepo = document.getElementById('box-repo');

// Syncs the HTML visualizer with the JavaScript arrays
function renderVisualizer() {
    if (!gitState.isInitialized) return;
    visContainer.style.opacity = "1";

    // Render Workspace
    boxWorkspace.innerHTML = '';
    gitState.workspace.forEach(file => {
        boxWorkspace.innerHTML += `<div class="git-file untracked">${file}</div>`;
    });

    // Render Staging
    boxStaging.innerHTML = '';
    gitState.staging.forEach(file => {
        boxStaging.innerHTML += `<div class="git-file tracked">${file}</div>`;
    });

    // Render Repo (Commits)
    boxRepo.innerHTML = '';
    gitState.commits.forEach(commit => {
        boxRepo.innerHTML += `
            <div class="git-commit">
                <div class="commit-hash">${commit.hash}</div>
                <div class="commit-msg">"${commit.message}"</div>
            </div>`;
    });
}

// Generates a fake 7-character commit hash
function generateHash() {
    return Math.random().toString(16).substring(2, 9);
}

// --- JQUERY TERMINAL ---
jQuery(function($, undefined) {
    $('#terminal-window').terminal(function(commandString, term) {
        
        let args = $.terminal.split_command(commandString).args;
        let command = $.terminal.split_command(commandString).name;

        if (command === '') return;
        if (command !== 'git') {
            term.error(`bash: ${command}: command not found. Try typing 'git init'`);
            return;
        }

        let action = args[0];

        switch (action) {
            case 'init':
                if (gitState.isInitialized) {
                    term.echo("Reinitialized existing Git repository.");
                } else {
                    gitState.isInitialized = true;
                    // Spawn dummy files for the user to play with
                    gitState.workspace = ['index.html', 'style.css', 'app.js'];
                    term.echo("Initialized empty Git repository in /home/user/projects/.git/");
                    renderVisualizer();
                }
                break;

            case 'status':
                if (!gitState.isInitialized) { term.error("fatal: not a git repository"); break; }
                
                if (gitState.staging.length > 0) {
                    term.echo("Changes to be committed:");
                    gitState.staging.forEach(f => term.echo(`  [[b;#7ee787;]new file:   ${f}]`));
                    term.echo("");
                }
                if (gitState.workspace.length > 0) {
                    term.echo("Untracked files:");
                    term.echo('  (use "git add <file>..." to include in what will be committed)');
                    gitState.workspace.forEach(f => term.echo(`  [[b;#ff7b72;]${f}]`));
                }
                if (gitState.workspace.length === 0 && gitState.staging.length === 0) {
                    term.echo("nothing to commit, working tree clean");
                }
                break;

            case 'add':
                if (!gitState.isInitialized) { term.error("fatal: not a git repository"); break; }
                let targetFile = args[1];
                
                if (!targetFile) {
                    term.echo("Nothing specified, nothing added.");
                } else if (targetFile === '.') {
                    // Move ALL files from workspace to staging
                    if (gitState.workspace.length > 0) {
                        gitState.staging.push(...gitState.workspace);
                        gitState.workspace = [];
                        renderVisualizer();
                    }
                } else {
                    // Move SPECIFIC file
                    let index = gitState.workspace.indexOf(targetFile);
                    if (index > -1) {
                        gitState.workspace.splice(index, 1);
                        gitState.staging.push(targetFile);
                        renderVisualizer();
                    } else if (gitState.staging.includes(targetFile)) {
                        // Already staged, do nothing
                    } else {
                        term.error(`fatal: pathspec '${targetFile}' did not match any files`);
                    }
                }
                break;

            case 'commit':
                if (!gitState.isInitialized) { term.error("fatal: not a git repository"); break; }
                if (gitState.staging.length === 0) {
                    term.echo("nothing added to commit but untracked files present");
                    break;
                }

                if (args[1] === '-m' && args[2]) {
                    let msg = args.slice(2).join(" ").replace(/['"]/g, '');
                    let newHash = generateHash();
                    
                    // Create the commit object
                    gitState.commits.push({
                        hash: newHash,
                        message: msg,
                        files: [...gitState.staging]
                    });
                    
                    term.echo(`[master (root-commit) ${newHash}] ${msg}`);
                    term.echo(` ${gitState.staging.length} file(s) changed`);
                    
                    // Clear the staging area!
                    gitState.staging = [];
                    renderVisualizer();
                } else {
                    term.error("Aborting commit due to empty commit message. (Use -m 'message')");
                }
                break;

            default:
                if (!action) {
                    term.echo("usage: git [--version] [--help] <command> [<args>]");
                } else {
                    term.error(`git: '${action}' is not a git command.`);
                }
        }

    }, {
        greetings: '[[b;#ff7b72;]Git Simulator v1.0]\nType [[b;#79c0ff;]git init] to wake up the visualizer.\n',
        name: 'git_sim',
        prompt: '[[b;#7ee787;]user@jrnation]:[[b;#79c0ff;]~/projects]$ '
    });
});