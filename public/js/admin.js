/**
 * filter auto-submit, copy link, row and bulk delete.
 */

(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  const filterForm = document.getElementById("filters");
  const tbody = document.getElementById("prompt-rows");
  const selectAll = document.getElementById("select-all");
  const bulkBtn = document.getElementById("bulk-delete");
  const bulkCount = document.getElementById("bulk-count");

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    await window.ui.copyText(btn.dataset.copy);
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.textContent = "Copy link";
    }, 1500);
  });

  filterForm?.addEventListener("change", (e) => {
    if (e.target.name === "status" || e.target.name === "source") {
      filterForm.requestSubmit();
    }
  });

  if (!tbody) return;

  const setState = (btn, state) => {
    btn.dataset.state = state;
    btn.disabled = state === "busy";
  };

  const request = async (url, options) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "x-csrf-token": csrfToken,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      window.location.href = "/admin/login";
      throw new Error("Session expired");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || "Request failed");
    return data;
  };

  const decrement = (id, by) => {
    const el = document.getElementById(id);
    if (!el || by === 0) return;
    const n = parseInt(el.textContent.replace(/,/g, ""), 10);
    if (!Number.isNaN(n)) el.textContent = Math.max(0, n - by).toLocaleString("en-US");
  };

  const selectedRows = () =>
    [...tbody.querySelectorAll(".row-check:checked")].map((c) => c.closest("tr"));

  const updateBulk = () => {
    const checks = tbody.querySelectorAll(".row-check");
    const n = selectedRows().length;
    bulkCount.textContent = String(n);
    bulkBtn.classList.toggle("hidden", n === 0);
    if (bulkBtn.dataset.state !== "busy") setState(bulkBtn, "idle");
    if (selectAll) {
      selectAll.checked = n > 0 && n === checks.length;
      selectAll.indeterminate = n > 0 && n < checks.length;
    }
  };

  const removeRows = (rows) => {
    const count = (status) => rows.filter((r) => r.querySelector(`[data-status="${status}"]`)).length;
    decrement("stat-total", rows.length);
    decrement("stat-expired", count("expired"));
    decrement("stat-soon", count("soon"));
    decrement("stat-today", rows.filter((r) => r.dataset.today === "1").length);
    decrement("total-count", rows.length);

    rows.forEach((row) => row.classList.add("opacity-0"));
    setTimeout(() => {
      rows.forEach((row) => row.remove());
      if (!tbody.querySelector("tr")) {
        const wrap = document.getElementById("table-wrap");
        const remaining = parseInt(document.getElementById("total-count").textContent.replace(/,/g, ""), 10);
        if (remaining > 0) {
          window.location.assign(wrap.dataset.reloadUrl);
          return;
        }
        const tpl = document.getElementById("empty-state-tpl");
        wrap.replaceChildren(tpl.content.cloneNode(true));
      }
      updateBulk();
    }, 200);
  };

  tbody.addEventListener("click", async (e) => {
    const cancel = e.target.closest(".cancel-btn");
    if (cancel) {
      setState(cancel.previousElementSibling, "idle");
      return;
    }

    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    if (btn.dataset.state !== "confirm" && btn.dataset.state !== "error") {
      setState(btn, "confirm");
      return;
    }

    setState(btn, "busy");
    try {
      await request(`/admin/prompts/${btn.dataset.id}`, { method: "DELETE" });
      removeRows([btn.closest("tr")]);
    } catch {
      setState(btn, "error");
    }
  });

  tbody.addEventListener("change", (e) => {
    if (e.target.classList.contains("row-check")) updateBulk();
  });

  selectAll?.addEventListener("change", () => {
    tbody.querySelectorAll(".row-check").forEach((c) => {
      c.checked = selectAll.checked;
    });
    updateBulk();
  });

  bulkBtn.addEventListener("click", async () => {
    const rows = selectedRows();
    if (!rows.length) return;

    if (bulkBtn.dataset.state !== "confirm" && bulkBtn.dataset.state !== "error") {
      setState(bulkBtn, "confirm");
      return;
    }

    setState(bulkBtn, "busy");
    try {
      await request("/admin/prompts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: rows.map((r) => Number(r.dataset.rowId)) }),
      });
      setState(bulkBtn, "idle");
      removeRows(rows);
    } catch {
      setState(bulkBtn, "error");
    }
  });
})();
