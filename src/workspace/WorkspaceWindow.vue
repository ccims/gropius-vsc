<template>
    <vscode-dropdown id="workspace"></vscode-dropdown>
</template>

<script>
window.addEventListener('message', event => {
    if(event.data.command ==='setWorkspace') {
        const dropdown = document.getElementById('workspace');
        dropdown.innerHTML = event.data.workspaces.map(ws => '<vscode-option>${ws}</vscode-option>').join('');
    }
});
</script>