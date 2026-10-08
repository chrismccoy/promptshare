/**
 * Upload page: tabs, size counter, file loading and link building.
 */

(() => {
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const fileEl = document.getElementById("file");
  const drop = document.getElementById("drop");
  const preview = document.getElementById("preview");
  const filename = document.getElementById("filename");
  const sizeEl = document.getElementById("size");
  const shareBtn = document.getElementById("share-btn");
  const pill = document.getElementById("tab-pill");
  const tabPaste = document.getElementById("tab-paste");
  const tabUpload = document.getElementById("tab-upload");
  const builder = document.getElementById("builder");
  const result = document.getElementById("result");
  const link = document.getElementById("link");

  const MAX_BYTES = Number(form.dataset.maxBytes);
  const TOO_LARGE = `Too large — ${form.dataset.maxMb}MB max`;
  const csrfToken = form.querySelector('input[name="_csrf"]').value;
  const { showToast, copyText } = window.ui;

  let mode = form.dataset.defaultTab === "upload" ? "upload" : "paste";
  let fileText = "";
  let submitting = false;
  let built = false;

  const currentContent = () => (mode === "paste" ? input.value : fileText);
  const byteLength = (s) => new Blob([s]).size;

  const update = () => {
    const content = currentContent();
    sizeEl.textContent =
      `${(byteLength(content) / 1024).toFixed(1)} KB · ${content.length.toLocaleString("en-US")} chars`;
    shareBtn.disabled = submitting || built || !content.trim().length;
  };

  const hideResult = () => {
    built = false;
    result.classList.add("hidden");
    builder.classList.remove("hidden");
  };

  const showResult = (url) => {
    link.value = url;
    builder.classList.add("hidden");
    result.classList.remove("hidden");
    link.focus();
    link.select();
  };

  const setMode = (next) => {
    mode = next;
    const isPaste = next === "paste";
    document.getElementById("pane-paste").classList.toggle("hidden", !isPaste);
    document.getElementById("pane-upload").classList.toggle("hidden", isPaste);
    const active = isPaste ? tabPaste : tabUpload;
    const first = pill.parentElement.querySelector("button");
    pill.style.transform = `translateX(${active.offsetLeft - first.offsetLeft}px)`;
    tabPaste.classList.toggle("text-white", isPaste);
    tabUpload.classList.toggle("text-white", !isPaste);
    hideResult();
    update();
  };

  tabPaste.addEventListener("click", () => setMode("paste"));
  tabUpload.addEventListener("click", () => setMode("upload"));

  input.addEventListener("input", () => {
    hideResult();
    update();
  });

  const readFile = (file) => {
    if (file.size > MAX_BYTES) {
      fileEl.value = "";
      showToast(TOO_LARGE);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      fileText = String(reader.result);
      preview.textContent = fileText;
      preview.classList.remove("hidden");
      filename.textContent = `◆ ${file.name}`;
      hideResult();
      update();
    };
    reader.onerror = () => showToast("Could not read that file");
    reader.readAsText(file);
  };

  ["dragover", "dragenter"].forEach((type) =>
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add("dropzone-dragging");
    })
  );
  ["dragleave", "drop"].forEach((type) =>
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.remove("dropzone-dragging");
    })
  );
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  });
  fileEl.addEventListener("change", () => {
    if (fileEl.files[0]) readFile(fileEl.files[0]);
  });

  const reset = () => {
    input.value = "";
    fileEl.value = "";
    fileText = "";
    preview.textContent = "";
    preview.classList.add("hidden");
    filename.textContent = "";
    hideResult();
    update();
  };

  document.getElementById("clear-btn").addEventListener("click", reset);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = currentContent();
    if (submitting || built || !content.trim()) return;
    if (byteLength(content) > MAX_BYTES) {
      showToast(TOO_LARGE);
      return;
    }

    submitting = true;
    update();

    const body = new URLSearchParams(new FormData(form));
    body.set("content", content);

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json", "x-csrf-token": csrfToken },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Something went wrong");
        return;
      }
      built = true;
      showResult(data.url);
      showToast("Prompt shared ✓");
    } catch {
      showToast("Network error — try again");
    } finally {
      submitting = false;
      update();
    }
  });

  document.getElementById("copy-link").addEventListener("click", async () => {
    await copyText(link.value);
    showToast("Copied ✓");
  });

  update();
})();
