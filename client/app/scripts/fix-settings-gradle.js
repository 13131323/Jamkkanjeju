const fs = require('fs');
const p = 'android/settings.gradle';
if (fs.existsSync(p)) {
  const content = fs.readFileSync(p, 'utf8');
  const fixed = content.replace(/'\.\.\/(node_modules\/@reactvision)/g, "'../../$1");
  fs.writeFileSync(p, fixed, 'utf8');
}
