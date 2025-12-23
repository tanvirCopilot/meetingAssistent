import { execSync } from 'node:child_process';

execSync('tsc -p electron/tsconfig.electron.json', { stdio: 'inherit' });
