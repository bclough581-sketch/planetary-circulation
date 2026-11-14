'use strict';
// Synthetic records and isolated browser contexts only. Browser suites start
// their own loopback server; no manual server or real user profile is needed.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const suites=['test_journal_core.cjs','test_journal_regression.cjs','test_journal_migration.cjs','test_scoreboard.js',
 'test_journal_browser.cjs','test_journal_regression_browser.cjs','test_journal_migration_browser.cjs','test_offline_entry.cjs','test_nav_smoke.cjs'];
for(const suite of suites){
 console.log('\nRunning '+suite);
 const run=spawnSync(process.execPath,[path.join(__dirname,suite)],{stdio:'inherit',cwd:path.resolve(__dirname,'..'),timeout:120000});
 if(run.error){console.error(run.error.message);process.exit(1);}
 if(run.status!==0)process.exit(run.status||1);
}
console.log('\nAll '+suites.length+' journal and integration checks passed.');
