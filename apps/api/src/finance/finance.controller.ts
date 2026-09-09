import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { BrowserWriteGuard } from '../auth/guards/browser-write.guard.js';
import type { AuthContext } from '../users/user.select.js';
import { AccountEntryQuery, AccountQuery, ExpenseCategoryDto, ExpenseDto, ExpenseQuery, MoneyAccountDto, PayableQuery, PaymentDto, PaymentQuery, ReasonDto, ReceivableQuery, TransferDto } from './finance.dto.js';
import { FinanceService } from './finance.service.js';

@Controller()
@UseGuards(BrowserWriteGuard, AuthGuard)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Post('accounts') @Header('Cache-Control','no-store') async createAccount(@CurrentAuth() auth: AuthContext, @Body() dto: MoneyAccountDto) { return { profile: await this.finance.createAccount(auth.user, dto) }; }
  @Get('accounts') @Header('Cache-Control','no-store') accounts(@CurrentAuth() auth: AuthContext, @Query() q: AccountQuery) { return this.finance.accounts(auth.user, q); }
  @Get('accounts/:id') @Header('Cache-Control','no-store') async account(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.account(auth.user, id) }; }
  @Patch('accounts/:id') @Header('Cache-Control','no-store') async updateAccount(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: MoneyAccountDto) { return { profile: await this.finance.updateAccount(auth.user, id, dto) }; }
  @Delete('accounts/:id') @Header('Cache-Control','no-store') deactivateAccount(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.finance.deactivateAccount(auth.user, id); }
  @Get('accounts/:id/transactions') @Header('Cache-Control','no-store') accountEntries(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Query() q: AccountEntryQuery) { return this.finance.accountEntries(auth.user, id, q); }

  @Post('payments') @Header('Cache-Control','no-store') async createPayment(@CurrentAuth() auth: AuthContext, @Body() dto: PaymentDto) { return { profile: await this.finance.createPayment(auth.user, dto) }; }
  @Get('payments') @Header('Cache-Control','no-store') payments(@CurrentAuth() auth: AuthContext, @Query() q: PaymentQuery) { return this.finance.payments(auth.user, q); }
  @Get('payments/:id') @Header('Cache-Control','no-store') async payment(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.payment(auth.user, id) }; }
  @Patch('payments/:id') @Header('Cache-Control','no-store') async updatePayment(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: PaymentDto) { return { profile: await this.finance.updatePayment(auth.user, id, dto) }; }
  @Delete('payments/:id') @Header('Cache-Control','no-store') deletePayment(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.finance.deletePayment(auth.user, id); }
  @Post('payments/:id/post') @Header('Cache-Control','no-store') async postPayment(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.postPayment(auth.user, id) }; }
  @Post('payments/:id/reverse') @Header('Cache-Control','no-store') async reversePayment(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReasonDto) { return { profile: await this.finance.reversePayment(auth.user, id, dto) }; }

  @Post('expense-categories') @Header('Cache-Control','no-store') async createExpenseCategory(@CurrentAuth() auth: AuthContext, @Body() dto: ExpenseCategoryDto) { return { profile: await this.finance.createExpenseCategory(auth.user, dto) }; }
  @Get('expense-categories') @Header('Cache-Control','no-store') expenseCategories(@CurrentAuth() auth: AuthContext, @Query() q: AccountQuery) { return this.finance.expenseCategories(auth.user, q); }
  @Patch('expense-categories/:id') @Header('Cache-Control','no-store') async updateExpenseCategory(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ExpenseCategoryDto) { return { profile: await this.finance.updateExpenseCategory(auth.user, id, dto) }; }
  @Delete('expense-categories/:id') @Header('Cache-Control','no-store') deactivateExpenseCategory(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.finance.deactivateExpenseCategory(auth.user, id); }

  @Post('expenses') @Header('Cache-Control','no-store') async createExpense(@CurrentAuth() auth: AuthContext, @Body() dto: ExpenseDto) { return { profile: await this.finance.createExpense(auth.user, dto) }; }
  @Get('expenses') @Header('Cache-Control','no-store') expenses(@CurrentAuth() auth: AuthContext, @Query() q: ExpenseQuery) { return this.finance.expenses(auth.user, q); }
  @Get('expenses/:id') @Header('Cache-Control','no-store') async expense(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.expense(auth.user, id) }; }
  @Patch('expenses/:id') @Header('Cache-Control','no-store') async updateExpense(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ExpenseDto) { return { profile: await this.finance.updateExpense(auth.user, id, dto) }; }
  @Delete('expenses/:id') @Header('Cache-Control','no-store') deleteExpense(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return this.finance.deleteExpense(auth.user, id); }
  @Post('expenses/:id/post') @Header('Cache-Control','no-store') async postExpense(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.postExpense(auth.user, id) }; }
  @Post('expenses/:id/cancel') @Header('Cache-Control','no-store') async cancelExpense(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReasonDto) { return { profile: await this.finance.cancelExpense(auth.user, id, dto) }; }

  @Get('account-transfers') @Header('Cache-Control','no-store') transfers(@CurrentAuth() auth: AuthContext, @Query() q: PaymentQuery) { return this.finance.transfers(auth.user, q); }
  @Get('account-transfers/:id') @Header('Cache-Control','no-store') async transfer(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) { return { profile: await this.finance.transfer(auth.user, id) }; }
  @Post('account-transfers') @Header('Cache-Control','no-store') async createTransfer(@CurrentAuth() auth: AuthContext, @Body() dto: TransferDto) { return { profile: await this.finance.createTransfer(auth.user, dto) }; }
  @Post('account-transfers/:id/reverse') @Header('Cache-Control','no-store') async reverseTransfer(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReasonDto) { return { profile: await this.finance.reverseTransfer(auth.user, id, dto) }; }

  @Get('receivables') @Header('Cache-Control','no-store') receivables(@CurrentAuth() auth: AuthContext, @Query() q: ReceivableQuery) { return this.finance.receivables(auth.user, q); }
  @Get('payables') @Header('Cache-Control','no-store') payables(@CurrentAuth() auth: AuthContext, @Query() q: PayableQuery) { return this.finance.payables(auth.user, q); }
}
