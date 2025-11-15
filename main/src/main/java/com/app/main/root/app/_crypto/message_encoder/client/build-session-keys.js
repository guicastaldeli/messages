const fs = require('fs');
const path = require('path');

function findSessionKeysFile() {
    const paths = [
        path.join(__dirname, '../_keys/session-keys.dat'),
        path.join(process.cwd(), 'app/_crypto/message_encoder/_keys/session-keys.dat'),
    ];

    for(const path of paths) {
        console.log('Checking:', path);
        if(fs.existsSync(path)) {
            console.log('Found session keys at:', path);
            return path;
        }
    }
}

const sessionKeysPath = findSessionKeysFile();
const outputPath = path.join(__dirname, 'session-keys.ts');
if(!sessionKeysPath) {
    console.log('Could not find session-keys.dat');
    console.log('Current working directory', process.cwd());
    console.log('dirname', __dirname);
    process.exit(1);
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
} catch(err) {
    console.error('Error embedding session keys: ', err);
    process.exit(1);
}