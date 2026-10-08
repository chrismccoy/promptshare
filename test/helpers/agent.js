/**
 * supertest with cookies and a CSRF token.
 */

const request = require("supertest");
const { ADMIN_USERNAME, ADMIN_PASSWORD } = require("./env");

const csrfFrom = (html) => {
  const match =
    html.match(/name="_csrf" value="([^"]+)"/) ||
    html.match(/name="csrf-token" content="([^"]+)"/);
  if (!match) throw new Error("No CSRF token found in page");
  return match[1];
};

const createAgent = async (app) => {
  const agent = request.agent(app);
  const page = await agent.get("/");
  const token = csrfFrom(page.text);

  return {
    agent,
    token,
    post: (url, fields = {}, { json = false } = {}) => {
      const req = agent.post(url).type("form");
      if (json) req.set("Accept", "application/json");
      return req.send({ _csrf: token, ...fields });
    },
    postJson: (url, body) =>
      agent.post(url).set("Accept", "application/json").set("x-csrf-token", token).send(body),
    del: (url) =>
      agent.delete(url).set("Accept", "application/json").set("x-csrf-token", token),
    login: (username = ADMIN_USERNAME, password = ADMIN_PASSWORD) =>
      agent.post("/admin/login").type("form").send({ _csrf: token, username, password }),
  };
};

module.exports = { createAgent, csrfFrom };
