// 1. VIRTUAL FILE SYSTEM
let fileSystem = {
    "home": {
        "user": {
            "projects": {
                "website": {
                    "index.html": "<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body>Hello World</body>\n</html>",
                    "style.css": "body { background: #000; color: #fff; }"
                },
                "script.sh": "#!/bin/bash\necho 'Hello World!'"
            },
            "notes.txt": "Meeting at 5PM.\nBuy milk.",
            "syslog.txt": "Jan 12 08:30:00 systemd: Starting Service...\nJan 12 08:30:05 apache2: [error] config missing\nJan 12 08:31:00 sshd: Failed password for root",
            "document.txt": "This file is owned by root.",
            ".bashrc": "# ~/.bashrc\nalias update='sudo apt update'\nexport PATH='/usr/local/bin'"
        }
    },
    "etc": {
        "passwd": "root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:user,,,:/home/user:/bin/bash"
    }
};

let currentPath = ["home", "user"];

// 2. SHADOW METADATA (For ls -l, chmod, chown)
let metadata = {
    "/home/user/document.txt": { perms: "-rw-r--r--", owner: "root", group: "root" },
    "/home/user/projects/script.sh": { perms: "-rw-r--r--", owner: "user", group: "user" }
};

function getMeta(absPath, isDir) {
    if (metadata[absPath]) return metadata[absPath];
    return {
        perms: isDir ? "drwxr-xr-x" : "-rw-r--r--",
        owner: absPath.startsWith("/etc") ? "root" : "user",
        group: absPath.startsWith("/etc") ? "root" : "user",
        size: Math.floor(Math.random() * 4000) + 100,
        date: "Oct 26 10:00"
    };
}

// 3. VIRTUAL PROCESS TABLE (For ps, top, kill)
let processes = [
    { pid: 1, user: "root", cpu: "0.0", mem: "0.1", command: "/sbin/init" },
    { pid: 42, user: "root", cpu: "0.0", mem: "0.2", command: "/lib/systemd/systemd-journald" },
    { pid: 105, user: "root", cpu: "0.0", mem: "0.1", command: "/usr/sbin/sshd -D" },
    { pid: 1337, user: "user", cpu: "99.9", mem: "14.5", command: "./rogue_miner.sh" }, // The Target
    { pid: 2048, user: "user", cpu: "0.1", mem: "0.5", command: "-bash" }
];

// Helper functions
function getCurrentFolder() {
    let folder = fileSystem;
    for (let dir of currentPath) folder = folder[dir];
    return folder;
}

function getPrompt() {
    let displayPath = currentPath.join('/') === 'home/user' ? '~' : '/' + currentPath.join('/');
    return `[[b;#7ee787;]user@jrnation]:[[b;#79c0ff;]${displayPath}]$ `;
}

// 4. INITIALIZE JQUERY TERMINAL
jQuery(function($, undefined) {
    $('#terminal-window').terminal(function(commandString, term) {
        
        let args = $.terminal.split_command(commandString).args;
        let command = $.terminal.split_command(commandString).name;
        let currentFolder = getCurrentFolder();

        if (command === '') return;

        switch (command) {
            case 'help':
                term.echo('Available commands: [[b;#fff;]ls, cd, pwd, cat, tail, grep, mkdir, touch, rm, chmod, chown, sudo, ps, top, kill, clear]');
                break;

            case 'clear': term.clear(); break;
            case 'pwd': term.echo('/' + currentPath.join('/')); break;
            case 'whoami': term.echo('[[b;#7ee787;]user]'); break;
            case 'date': term.echo(new Date().toString()); break;
            case 'uname': term.echo(args.includes('-a') ? "Linux jrnation-server 6.8.0-76 x86_64 GNU/Linux" : "Linux"); break;

            case 'ls':
                let showHidden = args.includes('-a') || args.includes('-la') || args.includes('-al');
                let isLongFormat = args.includes('-l') || args.includes('-la') || args.includes('-al');
                let items = Object.keys(currentFolder);
                
                if (!showHidden) items = items.filter(item => !item.startsWith('.'));
                if (items.length === 0) return;
                
                if (isLongFormat) {
                    let output = [`total ${items.length * 4}`];
                    for (let item of items) {
                        let isDir = typeof currentFolder[item] === 'object';
                        let absPath = ('/' + currentPath.join('/') + '/' + item).replace('//', '/');
                        let meta = getMeta(absPath, isDir);
                        let nameColored = isDir ? `[[b;#79c0ff;]${item}]` : item;
                        output.push(`${meta.perms} 1 ${meta.owner} ${meta.group}\t${meta.size} ${meta.date} ${nameColored}`);
                    }
                    term.echo(output.join('\n'));
                } else {
                    term.echo(items.map(item => typeof currentFolder[item] === 'object' ? `[[b;#79c0ff;]${item}/]` : item).join('   '));
                }
                break;

            case 'cd':
                let target = args[0];
                if (!target || target === '~') currentPath = ["home", "user"];
                else if (target === '/') currentPath = [];
                else if (target === '..') { if (currentPath.length > 0) currentPath.pop(); }
                else if (currentFolder[target] && typeof currentFolder[target] === 'object') currentPath.push(target);
                else term.error(`bash: cd: ${target}: No such file or directory`);
                term.set_prompt(getPrompt());
                break;

            case 'mkdir':
                if (!args[0]) term.error('mkdir: missing operand');
                else if (currentFolder[args[0]]) term.error(`mkdir: cannot create directory '${args[0]}': File exists`);
                else currentFolder[args[0]] = {}; 
                break;

            case 'touch':
                if (!args[0]) term.error('touch: missing file operand');
                else if (!currentFolder[args[0]]) currentFolder[args[0]] = ""; 
                break;

            case 'rm':
                let isRecursive = args.includes('-r') || args.includes('-rf');
                let targetRm = args.filter(a => !a.startsWith('-'))[0]; 

                if (!targetRm) term.error('rm: missing operand');
                else if (targetRm === '.' || targetRm === '..') term.error(`rm: refusing to remove '.' or '..' directory`);
                else if (currentFolder[targetRm] !== undefined) {
                    if (typeof currentFolder[targetRm] === 'object' && !isRecursive) term.error(`rm: cannot remove '${targetRm}': Is a directory`);
                    else delete currentFolder[targetRm];
                } else term.error(`rm: cannot remove '${targetRm}': No such file or directory`);
                break;

            case 'cat':
                if (!args[0]) term.error('cat: missing operand');
                else if (currentFolder[args[0]] === undefined) term.error(`cat: ${args[0]}: No such file or directory`);
                else if (typeof currentFolder[args[0]] === 'object') term.error(`cat: ${args[0]}: Is a directory`);
                else term.echo(currentFolder[args[0]]);
                break;

            case 'tail':
                if (!args[0]) { term.error('tail: missing operand'); break; }
                let tailFile = currentFolder[args[0]];
                if (tailFile === undefined) term.error(`tail: ${args[0]}: No such file or directory`);
                else if (typeof tailFile === 'object') term.error(`tail: ${args[0]}: Is a directory`);
                else term.echo(tailFile.split('\n').slice(-5).join('\n').replace(/</g, "&lt;").replace(/>/g, "&gt;"));
                break;

            case 'grep':
                let flag = args[0] && args[0].startsWith('-') ? args[0] : '';
                let searchTerm = flag ? args[1] : args[0];
                let targetFile = flag ? args[2] : args[1];

                if (!searchTerm || !targetFile) { term.error('grep: usage: grep [options] "pattern" file'); break; }
                let fileContent = currentFolder[targetFile];

                if (fileContent === undefined) term.error(`grep: ${targetFile}: No such file`);
                else if (typeof fileContent === 'object') term.error(`grep: ${targetFile}: Is a directory`);
                else {
                    let lines = fileContent.split('\n');
                    let matchCount = 0;
                    for (let line of lines) {
                        let match = flag === '-i' ? line.toLowerCase().includes(searchTerm.toLowerCase()) : line.includes(searchTerm);
                        if (match) {
                            matchCount++;
                            if (flag !== '-c') {
                                let regex = new RegExp(searchTerm, flag === '-i' ? 'gi' : 'g');
                                term.echo(line.replace(regex, `[[b;#ff5f56;]$&]`));
                            }
                        }
                    }
                    if (flag === '-c') term.echo(matchCount.toString());
                }
                break;

            // --- PERMISSIONS ---
            case 'chmod':
                let mode = args[0];
                let targetMod = args[1];
                if (!targetMod) { term.error("chmod: missing operand"); break; }
                if (currentFolder[targetMod] === undefined) { term.error(`chmod: cannot access '${targetMod}': No such file or directory`); break; }
                
                let absPathMod = ('/' + currentPath.join('/') + '/' + targetMod).replace('//', '/');
                if (!metadata[absPathMod]) metadata[absPathMod] = getMeta(absPathMod, typeof currentFolder[targetMod] === 'object');

                if (mode === '+x') metadata[absPathMod].perms = typeof currentFolder[targetMod] === 'object' ? "drwxr-xr-x" : "-rwxr-xr-x";
                else if (mode === '777') metadata[absPathMod].perms = typeof currentFolder[targetMod] === 'object' ? "drwxrwxrwx" : "-rwxrwxrwx";
                else term.echo(`chmod applied mode ${mode} (Simulated)`);
                break;

            case 'sudo':
                if (args[0] === 'chown') {
                    let ownership = args[1]; 
                    let targetOwn = args[2];
                    if (!targetOwn || currentFolder[targetOwn] === undefined) { term.error(`chown: cannot access '${targetOwn}': No such file`); break; }
                    let parts = ownership.split(':');
                    
                    let p = ('/' + currentPath.join('/') + '/' + targetOwn).replace('//', '/');
                    if (!metadata[p]) metadata[p] = getMeta(p, typeof currentFolder[targetOwn] === 'object');
                    
                    metadata[p].owner = parts[0];
                    metadata[p].group = parts[1] || parts[0];
                } else if (args[0] === 'rm') {
                    term.error("user is not in the sudoers file. This incident will be reported.");
                } else {
                    term.error("sudo command restricted in web environment.");
                }
                break;

            // --- PROCESS CONTROL ---
            case 'ps':
                let psOut = "USER       PID %CPU %MEM COMMAND\n";
                processes.forEach(p => {
                    psOut += `${p.user.padEnd(10)} ${p.pid.toString().padEnd(5)} ${p.cpu.padEnd(4)} ${p.mem.padEnd(4)} ${p.command}\n`;
                });
                term.echo(psOut.trim());
                break;

            case 'top':
                let topOut = `top - 10:15:32 up 14 days,  2:14,  1 user,  load average: 2.14, 1.89, 1.55\n`;
                topOut += `Tasks:  95 total,   2 running,  93 sleeping,   0 stopped,   0 zombie\n`;
                let cpuUsage = processes.find(p => p.command.includes("rogue_miner")) ? "99.9" : "0.5";
                topOut += `%Cpu(s): ${cpuUsage} us,  3.1 sy,  0.0 ni,  1.2 id,  0.0 wa,  0.0 hi,  0.2 si,  0.0 st\n`;
                topOut += `MiB Mem :   7964.3 total,   1245.2 free,   4512.1 used,   2207.0 buff/cache\n\n`;
                topOut += "  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n";
                
                // Sort processes by CPU usage so the miner is at the top
                [...processes].sort((a,b) => parseFloat(b.cpu) - parseFloat(a.cpu)).forEach(p => {
                    let state = parseFloat(p.cpu) > 10 ? 'R' : 'S';
                    topOut += ` ${p.pid.toString().padEnd(5)} ${p.user.padEnd(9)}  20   0  145236  12544   8192 ${state}  ${p.cpu.padEnd(4)}  ${p.mem.padEnd(4)}   0:00.00 ${p.command}\n`;
                });
                term.echo(topOut.trim());
                break;

            case 'kill':
                let targetPid = args[0] === '-9' ? args[1] : args[0];
                if (!targetPid) {
                    term.error("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]");
                    break;
                }
                
                let pIndex = processes.findIndex(p => p.pid.toString() === targetPid.toString());
                if (pIndex === -1) {
                    term.error(`bash: kill: (${targetPid}) - No such process`);
                } else {
                    let killed = processes.splice(pIndex, 1)[0];
                    if (killed.command.includes('rogue_miner')) {
                        term.echo(`[[b;#7ee787;]Success!] Process ${targetPid} (rogue_miner.sh) terminated. The CPU has cooled down.`);
                    }
                }
                break;

            case 'neofetch':
                term.echo(`
[[b;#79c0ff;]       _         ][[b;#7ee787;]user@jrnation]
[[b;#79c0ff;]      / \\        ]------------
[[b;#79c0ff;]     /   \\       ]OS: JR Nation Terminal OS
[[b;#79c0ff;]    /^.   \\      ]Kernel: WebAssembly/JS
[[b;#79c0ff;]   /  .-.  \\     ]Shell: jQuery Terminal
[[b;#79c0ff;]  /  (   ) _\\    ]Theme: Hacker Dark
[[b;#79c0ff;] / _.~   ~._ \\   ]  
[[b;#79c0ff;]/.^         ^.\\  ] 
                `);
                break;


                // --- SCRIPT EXECUTION ---
            case './script.sh':
                if (currentPath.join('/') === 'home/user/projects') {
                    // Check if it has execute permissions
                    let abs = '/home/user/projects/script.sh';
                    if (metadata[abs] && metadata[abs].perms.includes('x')) {
                        term.echo("Hello World!");
                    } else {
                        term.error(`bash: ./script.sh: Permission denied`);
                    }
                } else {
                    term.error(`bash: ./script.sh: No such file or directory`);
                }
                break;
                

            default:
                term.error(`bash: ${command}: command not found`);
        }
    }, {
        greetings: 'Welcome to JR Nation Terminal Hub \nType [[b;#ffbd2e;]help] to see available commands.\n',
        name: 'jr_nation_terminal',
        prompt: getPrompt(),
        completion: true
    });
});