const fs = require("fs");
const html = fs.readFileSync("storybook_studio/index.html", "utf8");
const app = fs.readFileSync("storybook_studio/js/app.js", "utf8");
const sm = fs.readFileSync("storybook_studio/js/ui/story_manager.js", "utf8");

// Check duplicate toast
const toastCount = (html.match(/id="toastMessage"/g) || []).length;
console.log("=== AUDIT REPORT ===");
console.log("Toast divs:", toastCount, toastCount === 1 ? "OK" : "BUG: DUPLICATE");

// Script order
const scripts = (html.match(/src="[^"]+\.js"/g)||[]).map(function(s){ return s.replace(/src="|"$/g,""); });
console.log("Scripts loaded:", scripts.join(" -> "));

// Key IDs in HTML
var checkIds = ["storyManagerModal","promptsModal","createNewBookBtn","addSceneConfirmBtn","templatesGrid","addStoriesBtn","newBookBtn","addSceneBtn","closeModalBtn","closePromptsModalBtn"];
checkIds.forEach(function(id) {
  var found = (html.match(new RegExp('id="'+id+'"','g'))||[]).length;
  console.log(id+":", found === 1 ? "OK" : found === 0 ? "MISSING !!!" : "DUPLICATE x"+found);
});

// Check key bindings in app.js
console.log("\n--- app.js key checks ---");
console.log("addStoriesBtn bound:", app.includes("addStoriesBtn") ? "YES" : "NO");
console.log("newBookBtn opens modal:", app.includes("openModal") ? "YES" : "NO");
console.log("storyManager ref:", app.includes("window.storyManager") ? "YES" : "NO");

// Check story_manager.js
console.log("\n--- story_manager.js checks ---");
console.log("openModal defined:", sm.includes("openModal(") ? "YES" : "NO");
console.log("createNewBookBtn bound:", sm.includes("createNewBookBtn") ? "YES" : "NO");
console.log("_createNewBook defined:", sm.includes("_createNewBook()") ? "YES" : "NO");
console.log("templatesGrid rendered:", sm.includes("_renderTemplatesGrid") ? "YES" : "NO");
console.log("STORY_TEMPLATES used:", sm.includes("STORY_TEMPLATES") ? "YES" : "NO");
