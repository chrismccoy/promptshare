/**
 * copy the prompt to the clipboard.
 */

(() => {
  const promptEl = document.getElementById("prompt");
  const label = document.getElementById("copy-label");
  const { showToast, copyText } = window.ui;

  document.getElementById("copy-btn").addEventListener("click", async () => {
    await copyText(promptEl.textContent);
    label.textContent = "Copied!";
    showToast("Copied ✓");
    setTimeout(() => {
      label.textContent = "Copy prompt";
    }, 2000);
  });
})();
