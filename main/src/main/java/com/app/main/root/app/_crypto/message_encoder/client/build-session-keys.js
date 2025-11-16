const fs = require('fs');
const path = require('path');

function findSessionKeysFile() {
    const paths = [
        path.join(__dirname, '../_keys/session-keys.dat'),
        path.join(process.cwd(), 'app/_crypto/message_encoder/_keys/session-keys.dat'),
    ];

    for(const filePath of paths) {
        console.log('Checking:', filePath);
        if(fs.existsSync(filePath)) {
            console.log('Found session keys at:', filePath);
            return filePath;
        }
    }
    return null;
}

function embedSessionKeys() {
    const sessionKeysPath = findSessionKeysFile();
    const outputPath = path.join(__dirname, 'session-keys.ts');
    
    if(!sessionKeysPath) {
        console.log('Could not find session-keys.dat');
        console.log('Current working directory', process.cwd());
        console.log('dirname', __dirname);
        return false;
    }

    try {
        const fileBuffer = fs.readFileSync(sessionKeysPath);
        const base64Data = fileBuffer.toString('base64');
        
        const tsContent = `
            //DO NOT EDIT... --- Client Keys
            export const SESSION_KEYS_DATA = '${base64Data}';
        `.trim();

        const outputDir = path.dirname(outputPath);
        if(!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, tsContent);
        console.log('Session Keys embedd success!');
        console.log('Output file', outputPath);
        return true;
    } catch(err) {
        console.error('Error embedding session keys: ', err);
        return false;
    }
}

const watchMode = process.argv.includes('--watch') || process.argv.includes('-w');

if (watchMode) {
    const sessionKeysPath = findSessionKeysFile();
    if (!sessionKeysPath) {
        console.error('Could not find session-keys.dat for watching');
        process.exit(1);
    }
    console.log('Watching for changes to session-keys.dat...');
    console.log('File:', sessionKeysPath);

    embedSessionKeys();
    let debounceTimer;
    fs.watch(sessionKeysPath, (eventType, filename) => {
        if (eventType === 'change') {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log('\nDetected change in session-keys.dat');
                console.log('Generating updated session-keys.ts at', new Date().toLocaleTimeString());
                embedSessionKeys();
            }, 100);
        }
    });
    process.on('SIGINT', () => {
        console.log('Stopping watcher...');
        process.exit(0);
    });
} else {
    const success = embedSessionKeys();
    process.exit(success ? 0 : 1);
}