/* SugarCube Story JavaScript */
Config.history.maxStates = 1;
setup.items = ["sword", "shield", "potion"];
window.addGold = function (amount) {
    State.variables.gold = (State.variables.gold || 0) + amount;
    return State.variables.gold;
};
setup.describe = (name) => {
    const v = State.variables;
    if (v.inventory.includes(name)) {
        return `You have the ${name}.`;
    }
    return "You don't have that.";
};
setup.visit = function () {
    State.temporary.scratch = setup.items.length;
    State.setVar("$visits", State.getVar("$visits") + 1);
};
setup.handler0 = function (ev) { let x0 = State.variables.counter0 + 0; State.variables.flag0 = x0 > 3; return x0; };
setup.handler1 = function (ev) { let x1 = State.variables.counter1 + 1; State.variables.flag1 = x1 > 3; return x1; };
setup.handler2 = function (ev) { let x2 = State.variables.counter2 + 2; State.variables.flag2 = x2 > 3; return x2; };
setup.handler3 = function (ev) { let x3 = State.variables.counter3 + 3; State.variables.flag3 = x3 > 3; return x3; };
setup.handler4 = function (ev) { let x4 = State.variables.counter0 + 4; State.variables.flag4 = x4 > 3; return x4; };
setup.handler5 = function (ev) { let x5 = State.variables.counter1 + 5; State.variables.flag5 = x5 > 3; return x5; };
setup.handler6 = function (ev) { let x6 = State.variables.counter2 + 6; State.variables.flag6 = x6 > 3; return x6; };
setup.handler7 = function (ev) { let x7 = State.variables.counter3 + 7; State.variables.flag7 = x7 > 3; return x7; };
setup.handler8 = function (ev) { let x8 = State.variables.counter0 + 8; State.variables.flag8 = x8 > 3; return x8; };
setup.handler9 = function (ev) { let x9 = State.variables.counter1 + 9; State.variables.flag9 = x9 > 3; return x9; };
setup.handler10 = function (ev) { let x10 = State.variables.counter2 + 10; State.variables.flag10 = x10 > 3; return x10; };
setup.handler11 = function (ev) { let x11 = State.variables.counter3 + 11; State.variables.flag11 = x11 > 3; return x11; };