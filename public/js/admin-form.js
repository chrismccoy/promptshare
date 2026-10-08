/**
 * Create/edit form: size counter and loading a .md/.txt file into the textarea.
 */

(() => {
  const form = document.getElementById("prompt-form");
  const textarea = document.getElementById("content");
  const counter = document.getElementById("counter");
  const fileEl = document.getElementById("file");
  const MAX_BYTES = Number(form.dataset.maxBytes);

  const update = () => {
    const bytes = new Blob([textarea.value]).size;
    counter.textContent =
      `${(bytes / 1024).toFixed(1)} KB · ${textarea.value.length.toLocaleString("en-US")} chars`;
    counter.classList.toggle("text-red-600", bytes > MAX_BYTES);
  };

  textarea.addEventListener("input", update);

  fileEl.addEventListener("change", () => {
    const file = fileEl.files[0];
    fileEl.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      counter.textContent = `File is larger than ${form.dataset.maxMb} MB`;
      counter.classList.add("text-red-600");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result);
      update();
    };
    reader.readAsText(file);
  });

  update();
})();
