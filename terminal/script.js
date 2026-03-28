const inputField = document.getElementById('terminal-input');
const outputContainer = document.getElementById('terminal-output');
const terminalWindow = document.getElementById('terminal-window');
const dirDisplay = document.querySelector('.dir');

// 1. THE VIRTUAL FILE SYSTEM
let fileSystem = {
    "home": {
        "user": {
            "projects": {},
            "notes.txt": "Meeting at 5PM.\nBuy milk.\nFinish Linux tutorial.",
            "syslog.txt": "Jan 12 08:30:00 systemd: Starting Service...\nJan 12 08:30:05 apache2: [error] config file missing\nJan 12 08:31:00 sshd: Failed password for root\nJan 12 08:32:00 systemd: Network started\nJan 12 08:35:00 kernel: out of memory ERROR\nJan 12 08:40:00 apache2: [error] server crash"
        }
    }
};

let currentPath = ["home", "user"]; 

terminalWindow.addEventListener('click', () => inputField.focus());

inputField.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const fullCommand = inputField.value.trim();
        const displayPath = currentPath.join('/') === 'home/user' ? '~' : '/' + currentPath.join('/');
        
        printLine(`<span class="prompt"><span class="user">user@jrnation</span>:<span class="dir">${displayPath}</span>$</span> ${fullCommand}`);
        
        if (fullCommand !== "") {
            executeCommand(fullCommand);
        }

        inputField.value = '';
        terminalWindow.scrollTop = terminalWindow.scrollHeight;
    }
});

function getCurrentFolder() {
    let folder = fileSystem;
    for (let dir of currentPath) {
        folder = folder[dir];
    }
    return folder;
}

// 2. THE COMMAND ENGINE
function executeCommand(commandString) {
    const args = commandString.match(/(?:[^\s"']+|['"][^'"]*["'])+/g) || [];
    const command = args[0].toLowerCase();
    const currentFolder = getCurrentFolder();

    switch (command) {
        case 'help':
            printLine('Commands available: <b>ls, cd, pwd, mkdir, touch, cat, grep, tail, wc, rm, echo, clear</b>');
            break;

        case 'pwd':
            printLine('/' + currentPath.join('/'));
            break;

        case 'whoami':
            printLine('user');
            break;

        case 'clear':
            outputContainer.innerHTML = '';
            break;

        case 'ls':
            let items = Object.keys(currentFolder);
            if (items.length === 0) return;
            let lsOutput = items.map(item => {
                return typeof currentFolder[item] === 'object' 
                    ? `<span style="color: #3b82f6; font-weight: bold;">${item}/</span>` 
                    : item;
            }).join('  ');
            printLine(lsOutput);
            break;

        case 'cd':
            let target = args[1];
            if (!target || target === '~') {
                currentPath = ["home", "user"];
            } else if (target === '..') {
                if (currentPath.length > 1) currentPath.pop();
            } else if (currentFolder[target] && typeof currentFolder[target] === 'object') {
                currentPath.push(target);
            } else {
                printLine(`bash: cd: ${target}: No such file or directory`);
            }
            dirDisplay.innerText = currentPath.join('/') === 'home/user' ? '~' : '/' + currentPath.join('/');
            break;

        case 'mkdir':
            if (!args[1]) printLine('mkdir: missing operand');
            else if (currentFolder[args[1]]) printLine(`mkdir: cannot create directory '${args[1]}': File exists`);
            else currentFolder[args[1]] = {}; 
            break;

        case 'touch':
            if (!args[1]) printLine('touch: missing file operand');
            else if (!currentFolder[args[1]]) currentFolder[args[1]] = ""; 
            break;

        case 'rm':
            if (!args[1]) printLine('rm: missing operand');
            else if (currentFolder[args[1]] !== undefined) delete currentFolder[args[1]];
            else printLine(`rm: cannot remove '${args[1]}': No such file or directory`);
            break;

        case 'cat':
            if (!args[1]) printLine('cat: missing operand');
            else if (currentFolder[args[1]] === undefined) printLine(`cat: ${args[1]}: No such file or directory`);
            else if (typeof currentFolder[args[1]] === 'object') printLine(`cat: ${args[1]}: Is a directory`);
            else printLine(currentFolder[args[1]].replace(/\n/g, '<br>'));
            break;

        case 'echo':
            let text = args.slice(1).join(' ').replace(/['"]/g, '');
            printLine(text);
            break;

        case 'tail':
            if (!args[1]) { printLine('tail: missing operand'); break; }
            let tailFile = currentFolder[args[1]];
            if (tailFile === undefined) printLine(`tail: ${args[1]}: No such file or directory`);
            else if (typeof tailFile === 'object') printLine(`tail: ${args[1]}: Is a directory`);
            else {
                let lines = tailFile.split('\n');
                let lastLines = lines.slice(-3); // Shows last 3 lines
                printLine(lastLines.join('<br>'));
            }
            break;

        case 'wc':
            if (!args[1]) { printLine('wc: missing operand'); break; }
            let wcFile = currentFolder[args[1]];
            if (wcFile === undefined) printLine(`wc: ${args[1]}: No such file`);
            else if (typeof wcFile === 'object') printLine(`wc: ${args[1]}: Is a directory`);
            else {
                let lines = wcFile.split('\n').length;
                let words = wcFile.split(/\s+/).filter(w => w.length > 0).length;
                let chars = wcFile.length;
                printLine(`&nbsp;&nbsp;${lines}&nbsp;&nbsp;${words}&nbsp;&nbsp;${chars}&nbsp;${args[1]}`);
            }
            break;

        case 'grep':
            let flag = args[1] && args[1].startsWith('-') ? args[1] : '';
            let searchTerm = flag ? args[2] : args[1];
            let targetFile = flag ? args[3] : args[2];

            if (!searchTerm || !targetFile) {
                printLine('grep: usage: grep [options] "pattern" file');
                break;
            }

            searchTerm = searchTerm.replace(/['"]/g, '');
            let fileContent = currentFolder[targetFile];

            if (fileContent === undefined) printLine(`grep: ${targetFile}: No such file`);
            else if (typeof fileContent === 'object') printLine(`grep: ${targetFile}: Is a directory`);
            else {
                let lines = fileContent.split('\n');
                let matchCount = 0;

                for (let line of lines) {
                    let match = flag === '-i' 
                        ? line.toLowerCase().includes(searchTerm.toLowerCase())
                        : line.includes(searchTerm);
                    
                    if (match) {
                        matchCount++;
                        if (flag !== '-c') {
                            let regex = new RegExp(searchTerm, flag === '-i' ? 'gi' : 'g');
                            let highlightedLine = line.replace(regex, `<span style="color: #ff5f56; font-weight: bold;">$&</span>`);
                            printLine(highlightedLine);
                        }
                    }
                }
                if (flag === '-c') printLine(matchCount.toString());
            }
            break;

        default:
            printLine(`bash: ${command}: command not found`);
    }
}

function printLine(text) {
    const newLine = document.createElement('p');
    newLine.className = 'term-text';
    newLine.innerHTML = text;
    outputContainer.appendChild(newLine);
}