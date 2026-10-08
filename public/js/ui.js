/**
 * toast and clipboard copy with fallback.
 */

window.ui = (() => {
  const toast = document.getElementById("toast");
  let timer;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("translate-y-24", "opacity-0");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.add("translate-y-24", "opacity-0"), 1800);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.className = "fixed -left-[9999px] top-0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  };

  return { showToast, copyText };
})();
