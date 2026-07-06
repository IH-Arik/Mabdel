const fs = require('fs');
const path = require('path');
const dir = 'C:/project/Mabdel AI/Mabdel Website/src/pages/Profile/tabs';
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.jsx')) {
    const fp = path.join(dir, file);
    let content = fs.readFileSync(fp, 'utf8');
    content = content.replace(/from '\.\.\/\.\.\/api/g, "from '../../../api");
    content = content.replace(/from '\.\.\/\.\.\/store/g, "from '../../../store");
    fs.writeFileSync(fp, content);
  }
}
