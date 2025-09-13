// ---------------------------
// Banking Patterns Demo
// ---------------------------

// Observer Pattern: Customer
class Customer {
  constructor(name) { this.name = name; }
  update(message) {
    UI.notify(`[${this.name}] ${message}`);
  }
}

// Strategy Pattern: Interest Strategies
class InterestStrategy {
  calculate(balance) { throw new Error('Implement calculate'); }
}

class SavingsInterest extends InterestStrategy {
  calculate(balance) { return balance * 0.03; }
}

class FixedDepositInterest extends InterestStrategy {
  calculate(balance) { return balance * 0.07; }
}

class CurrentInterest extends InterestStrategy {
  calculate(balance) { return 0; }
}

// Account (Subject)
let accountIdSeq = 1;
class Account {
  constructor(owner, initialBalance = 0) {
    this.id = accountIdSeq++;
    this.owner = owner; // Customer instance
    this._balance = Number(initialBalance) || 0;
    this.observers = [];
    this.interestStrategy = new CurrentInterest();
    this.typeName = 'Generic';
  }

  getBalance() { return this._balance; }
  attach(observer) {
    if (!this.observers.includes(observer)) this.observers.push(observer);
  }
  detach(observer) {
    this.observers = this.observers.filter(o => o !== observer);
  }
  notify(message) {
    this.observers.forEach(o => o.update(`Acct#${this.id} (${this.typeName}): ${message}`));
  }

  updateBalance(delta, reason = '') {
    this._balance += Number(delta);
    this.notify(`${reason} ${delta >= 0 ? '+' : ''}${delta}. New balance: ₹${this._balance.toFixed(2)}`);
  }

  setInterestStrategy(strategy) { this.interestStrategy = strategy; }
  calculateInterest() { return this.interestStrategy.calculate(this._balance); }
  toString() {
    return `Acct#${this.id} (${this.typeName}) — ${this.owner.name} — ₹${this._balance.toFixed(2)}`;
  }
}

// Concrete account types
class SavingsAccount extends Account {
  constructor(owner, initial) {
    super(owner, initial);
    this.typeName = 'Savings';
    this.setInterestStrategy(new SavingsInterest());
  }
}

class CurrentAccount extends Account {
  constructor(owner, initial) {
    super(owner, initial);
    this.typeName = 'Current';
    this.setInterestStrategy(new CurrentInterest());
  }
}

class FixedDepositAccount extends Account {
  constructor(owner, initial) {
    super(owner, initial);
    this.typeName = 'FixedDeposit';
    this.setInterestStrategy(new FixedDepositInterest());
  }
}

// Command Pattern: Transaction Commands
class Command {
  execute() { throw new Error('execute'); }
  undo() { throw new Error('undo'); }
}

class DepositCommand extends Command {
  constructor(account, amount) { super(); this.account = account; this.amount = Number(amount); }
  execute() { this.account.updateBalance(this.amount, 'Deposit'); }
  undo() { this.account.updateBalance(-this.amount, 'Undo Deposit'); }
}

class WithdrawCommand extends Command {
  constructor(account, amount) { super(); this.account = account; this.amount = Number(amount); }
  execute() {
    if (this.account.getBalance() < this.amount) {
      UI.notify(`Withdraw failed: insufficient funds on Acct#${this.account.id}`);
      return;
    }
    this.account.updateBalance(-this.amount, 'Withdraw');
  }
  undo() { this.account.updateBalance(this.amount, 'Undo Withdraw'); }
}

class TransferCommand extends Command {
  constructor(fromAcct, toAcct, amount) { super(); this.from = fromAcct; this.to = toAcct; this.amount = Number(amount); }
  execute() {
    if (this.from.getBalance() < this.amount) {
      UI.notify(`Transfer failed: insufficient funds on Acct#${this.from.id}`);
      return;
    }
    this.from.updateBalance(-this.amount, `Transfer -> Acct#${this.to.id}`);
    this.to.updateBalance(this.amount, `Transfer <- Acct#${this.from.id}`);
  }
  undo() {
    this.from.updateBalance(this.amount, `Undo Transfer from Acct#${this.from.id}`);
    this.to.updateBalance(-this.amount, `Undo Transfer to Acct#${this.to.id}`);
  }
}

// Transaction Manager (Invoker)
class TransactionManager {
  constructor() { this.history = []; }
  executeCommand(cmd) {
    cmd.execute();
    this.history.push(cmd);
  }
  undoLast() {
    if (this.history.length === 0) { UI.notify('Nothing to undo'); return; }
    const last = this.history.pop();
    last.undo();
  }
}

// UI Utilities
const UI = (() => {
  const custListEl = document.getElementById('customersList');
  const accountsListEl = document.getElementById('accountsList');
  const selectAccountEl = document.getElementById('selectAccount');
  const transferToEl = document.getElementById('transferTo');
  const ownerSelectEl = document.getElementById('ownerSelect');
  const notificationsEl = document.getElementById('notifications');
  const interestValueEl = document.getElementById('interestValue');

  function renderCustomers(customers) {
    custListEl.innerHTML = customers.length === 0 ? '<div class="small muted">No customers yet</div>' : customers.map(c => `
      <div class="small">${c.name}</div>
    `).join('');
    ownerSelectEl.innerHTML = customers.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
  }

  function renderAccounts(accounts) {
    accountsListEl.innerHTML = accounts.length === 0 ? '<div class="small muted">No accounts</div>' : accounts.map(a => `
      <div class="account-row">
        <div>${a.typeName} — Acct#${a.id}</div>
        <div class="small">${a.owner.name} • ₹${a.getBalance().toFixed(2)}</div>
      </div>
    `).join('');
    const opts = accounts.map(a => `
      <option value="${a.id}">Acct#${a.id} (${a.typeName}) - ${a.owner.name} - ₹${a.getBalance().toFixed(2)}</option>
    `).join('');
    selectAccountEl.innerHTML = opts;
    transferToEl.innerHTML = opts;
  }

  function notify(msg) {
    const time = new Date().toLocaleTimeString();
    notificationsEl.insertAdjacentHTML('afterbegin', `<div><small>${time}</small> — ${msg}</div>`);
  }

  function setInterestText(val) {
    interestValueEl.innerText = `₹${(val || 0).toFixed(2)}`;
  }

  return { renderCustomers, renderAccounts, notify, setInterestText };
})();

// App State & Helpers
const App = (() => {
  const customers = [];
  const accounts = [];
  const tm = new TransactionManager();

  function addCustomer(name) {
    const customer = new Customer(name);
    customers.push(customer);
    UI.renderCustomers(customers);
    UI.notify(`Added customer ${name}`);
    return customer;
  }

  function createAccount(type, ownerIdx, initial) {
    const owner = customers[ownerIdx];
    if (!owner) { UI.notify('Select an owner'); return; }
    let account;
    switch (type) {
      case 'savings': account = new SavingsAccount(owner, initial); break;
      case 'current': account = new CurrentAccount(owner, initial); break;
      case 'fixed': account = new FixedDepositAccount(owner, initial); break;
      default: account = new Account(owner, initial);
    }
    account.attach(owner);
    accounts.push(account);
    UI.renderAccounts(accounts);
    UI.notify(`Created ${account.typeName} Acct#${account.id} for ${owner.name}`);
    return account;
  }

  function findAccountById(id) {
    return accounts.find(a => a.id === Number(id));
  }

  function deposit(accountId, amount) {
    const account = findAccountById(accountId);
    if (!account) { UI.notify('Select a valid account'); return; }
    tm.executeCommand(new DepositCommand(account, amount));
    UI.renderAccounts(accounts);
  }

  function withdraw(accountId, amount) {
    const account = findAccountById(accountId);
    if (!account) { UI.notify('Select a valid account'); return; }
    tm.executeCommand(new WithdrawCommand(account, amount));
    UI.renderAccounts(accounts);
  }

  function transfer(fromId, toId, amount) {
    const from = findAccountById(fromId);
    const to = findAccountById(toId);
    if (!from || !to) { UI.notify('Select valid accounts'); return; }
    if (from.id === to.id) { UI.notify('Cannot transfer to same account'); return; }
    tm.executeCommand(new TransferCommand(from, to, amount));
    UI.renderAccounts(accounts);
  }

  function undoLast() {
    tm.undoLast();
    UI.renderAccounts(accounts);
  }

  function applyStrategy(accountId, key) {
    const account = findAccountById(accountId);
    if (!account) { UI.notify('Select account to apply strategy'); return; }
    switch (key) {
      case 'savings': account.setInterestStrategy(new SavingsInterest()); break;
      case 'fixed': account.setInterestStrategy(new FixedDepositInterest()); break;
      case 'current': account.setInterestStrategy(new CurrentInterest()); break;
    }
    UI.notify(`Applied ${key} strategy to Acct#${account.id}`);
    UI.renderAccounts(accounts);
  }

  function calcInterest(accountId) {
    const account = findAccountById(accountId);
    if (!account) { UI.notify('Select an account'); return 0; }
    return account.calculateInterest();
  }

  return {
    addCustomer, createAccount, deposit, withdraw, transfer, undoLast, applyStrategy, calcInterest,
    get customers() { return customers; }, get accounts() { return accounts; }
  };
})();

// Event Listeners
document.getElementById('addCustBtn').addEventListener('click', () => {
  const name = document.getElementById('custName').value.trim();
  if (!name) { UI.notify('Enter a customer name'); return; }
  App.addCustomer(name);
  document.getElementById('custName').value = '';
});

document.getElementById('createAcctBtn').addEventListener('click', () => {
  const type = document.getElementById('acctType').value;
  const ownerIdx = Number(document.getElementById('ownerSelect').value);
  const initial = Number(document.getElementById('initBalance').value) || 0;
  App.createAccount(type, ownerIdx, initial);
});

document.getElementById('depositBtn').addEventListener('click', () => {
  const id = document.getElementById('selectAccount').value;
  const amt = Number(document.getElementById('amount').value) || 0;
  App.deposit(id, amt);
});

document.getElementById('withdrawBtn').addEventListener('click', () => {
  const id = document.getElementById('selectAccount').value;
  const amt = Number(document.getElementById('amount').value) || 0;
  App.withdraw(id, amt);
});

document.getElementById('transferBtn').addEventListener('click', () => {
  const from = document.getElementById('selectAccount').value;
  const to = document.getElementById('transferTo').value;
  const amt = Number(document.getElementById('amount').value) || 0;
  App.transfer(from, to, amt);
});

document.getElementById('undoBtn').addEventListener('click', () => {
  App.undoLast();
});

document.getElementById('applyStrategyBtn').addEventListener('click', () => {
  const id = document.getElementById('selectAccount').value;
  const key = document.getElementById('strategySelect').value;
  App.applyStrategy(id, key);
});

document.getElementById('selectAccount').addEventListener('change', (e) => {
  const id = e.target.value;
  if (id) UI.setInterestText(App.calcInterest(id));
});

document.getElementById('seedBtn').addEventListener('click', () => {
  if (App.customers.length) { UI.notify('Demo already seeded'); return; }
  App.addCustomer('Shivani');
  App.addCustomer('Ravi');
  App.createAccount('savings', 0, 1500);
  App.createAccount('current', 1, 500);
  UI.renderCustomers(App.customers);
  UI.renderAccounts(App.accounts);
});

// Initial Render
UI.renderCustomers(App.customers);
UI.renderAccounts(App.accounts);