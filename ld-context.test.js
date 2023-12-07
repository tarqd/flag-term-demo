const { mergeLDContext } = require("./ld-context");

const user = {
  kind: "user",
  key: "user-1",
  name: "User 1",
};
const session = {
  kind: "session",
  key: "session-1",
  name: "Session 1",
};
const browser = {
  kind: "browser",
  key: "firefox-100",
  name: "Firefox 100",
};

const multi = {
  kind: "multi",
  user: user,
  session: session,
};

test("two single contexts become multi", () => {
  expect(mergeLDContext(user, session)).toMatchObject({
    ...multi,
    user: { key: "user-1", name: "User 1" },
    session: { key: "session-1", name: "Session 1" },
  });
});

test("two multi contexts become multi", () => {
  const c1 = { kind: "multi", user: user };
  const c2 = { kind: "multi", session: session };
  expect(mergeLDContext(c1, c2)).toMatchObject({
    kind: "multi",
    user: { key: "user-1", name: "User 1" },
    session: { key: "session-1", name: "Session 1" },
  });
});

test("duplicate kinds throw", () => {
  expect(() => mergeLDContext(user, user)).toThrow();
});