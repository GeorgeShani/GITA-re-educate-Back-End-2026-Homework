#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs/promises';
import chalk from 'chalk';

const program = new Command();
const DB_FILE = "./expenses.json"

/**
 * Helper function to read data from the JSON file
 */
async function readExpenses() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If the file doesn't exist yet, return an empty array
    if (error.code === 'ENOENT') return [];
    console.error(chalk.red('Error reading the database file:'), error.message);
    return [];
  }
}

/**
 * Helper function to save data to the JSON file
 */
async function writeExpenses(expenses) {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(expenses, null, 2), 'utf-8');
  } catch (error) {
    console.error(chalk.red('Error writing to the database file:'), error.message);
  }
}

// --- CLI MAIN INFO ---
program
  .name('expense-cli')
  .description(
    chalk.cyan.bold('Expense Tracker CLI') +
    '\nAn interactive command-line application to manage your daily expenses efficiently using Node.js.'
  )
  .version('1.0.0', '-v, --version', 'Output the current version');

// --- CREATE COMMAND ---
program
  .command('add')
  .description('Add a new expense')
  .requiredOption('-c, --category <category>', 'Expense category')
  .requiredOption('-p, --price <price>', 'Expense price', parseFloat)
  .action(async (options) => {
    let { category, price } = options;

    // Validation: Price must be at least 10
    if (price < 10) {
      console.error(chalk.red.bold('Validation Error:'), chalk.yellow('Price must be 10 or greater.'));
      process.exit(1);
    }

    const expenses = await readExpenses();

    // Auto-increment sequential ID logic (1, 2, 3...)
    // If array is empty, start at 1. Otherwise, find the max ID and add 1.
    const nextId = expenses.length > 0
      ? Math.max(...expenses.map(exp => exp.id)) + 1
      : 1;

    const newExpense = {
      id: nextId,
      category: category.toLowerCase(),
      price,
      createdAt: new Date().toISOString()
    };

    expenses.push(newExpense);
    await writeExpenses(expenses);
    console.log(chalk.green('✅ Expense added successfully! ID:'), chalk.cyan(newExpense.id));
  });

// --- READ (SHOW) COMMAND ---
program
  .command('show')
  .description('Display expenses with sorting, filtering, and pagination')
  .option('--asc', 'Sort by date ascending')
  .option('--desc', 'Sort by date descending')
  .option('-c, --category <category>', 'Filter by category')
  .option('--page <page>', 'Page number', value => Number(value), 1)
  .option('--limit <limit>', 'Items per page', value => Number(value), 5)
  .action(async (options) => {
    let expenses = await readExpenses();

    if (options.category) {
      expenses = expenses.filter(
        exp => exp.category === options.category.toLowerCase()
      );
    }

    if (options.asc) {
      expenses.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    }

    if (options.desc) {
      expenses.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 5;

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedExpenses = expenses.slice(startIndex, endIndex);
    const totalPages = Math.ceil(expenses.length / limit);

    if (!paginatedExpenses.length) {
      console.log(chalk.yellow('No expenses found for the given criteria.'));
      return;
    }

    console.log(
      chalk.blue.bold(
        `\n--- Page ${page} of ${totalPages || 1} ---`
      )
    );

    console.table(paginatedExpenses);
  });

// --- GET BY ID COMMAND ---
program
  .command('getById <id>')
  .description('Retrieve a specific expense by ID')
  .action(async (id) => {
    const targetId = parseInt(id, 10);
    const expenses = await readExpenses();
    const expense = expenses.find(exp => exp.id === targetId);

    if (!expense) {
      console.log(chalk.red(`Expense with ID "${id}" not found.`));
      return;
    }

    console.log(chalk.cyan('Expense Details:'), expense);
  });

// --- UPDATE COMMAND ---
program
  .command('update <id>')
  .description('Update an expense by ID')
  .option('-c, --category <category>', 'New category')
  .option('-p, --price <price>', 'New price', parseFloat)
  .action(async (id, options) => {
    const targetId = parseInt(id, 10);
    const expenses = await readExpenses();
    const index = expenses.findIndex(exp => exp.id === targetId);

    if (index === -1) {
      console.error(chalk.red(`Error: Expense ID "${id}" not found.`));
      process.exit(1);
    }

    // Price validation during update
    if (options.price !== undefined && options.price < 10) {
      console.error(chalk.red.bold('Validation Error:'), chalk.yellow('Updated price must be at least 10.'));
      process.exit(1);
    }

    // Apply updates if provided
    if (options.category) expenses[index].category = options.category.toLowerCase();
    if (options.price !== undefined) expenses[index].price = options.price;

    await writeExpenses(expenses);
    console.log(chalk.green(`✅ Expense ID ${id} has been updated.`));
  });

// --- DELETE COMMAND ---
program
  .command('delete <id>')
  .description('Delete an expense by ID')
  .action(async (id) => {
    const targetId = parseInt(id, 10);
    const expenses = await readExpenses();
    const filteredExpenses = expenses.filter(exp => exp.id !== targetId);

    if (expenses.length === filteredExpenses.length) {
      console.log(chalk.red(`Expense with ID "${id}" not found.`));
      return;
    }

    await writeExpenses(filteredExpenses);
    console.log(chalk.green(`✅ Expense ID ${id} successfully deleted.`));
  });

// --- SEARCH BY DATE COMMAND ---
program
  .command('search <date>')
  .description('Search expenses by date (Format: YYYY-MM-DD)')
  .action(async (dateStr) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      console.error(chalk.red('Invalid format! Please use YYYY-MM-DD.'));
      process.exit(1);
    }

    const expenses = await readExpenses();
    const results = expenses.filter(exp => exp.createdAt.startsWith(dateStr));

    if (results.length === 0) {
      console.log(chalk.yellow(`No expenses found for date: ${dateStr}`));
      return;
    }

    console.log(chalk.magenta(`Found ${results.length} record(s) for ${dateStr}:`));
    console.table(results);
  });

program.parse(process.argv);