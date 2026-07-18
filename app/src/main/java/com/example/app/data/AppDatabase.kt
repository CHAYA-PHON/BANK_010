package com.example.app.data

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object AppDatabase {
    private const val PREFS_NAME = "saving_app_prefs"
    private const val KEY_TRANSACTIONS = "transactions"
    private const val KEY_WALLETS = "wallets"
    private const val KEY_DEBTS = "debts"
    private const val KEY_DEBT_PAYMENTS = "debt_payments"

    private val gson = Gson()

    fun getTransactions(context: Context): List<Transaction> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_TRANSACTIONS, null)
        if (json == null) {
            val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaults = listOf(
                Transaction("t1", "income", 35000.0, "เงินเดือนและรายได้", "บริษัท เทค จำกัด", nowStr, "10:00", "เงินเดือนประจำเดือน", null, nowStr, "w2", null, null),
                Transaction("t2", "expense", 150.0, "อาหารและเครื่องดื่ม", "ร้านก๋วยเตี๋ยวหน้าปากซอย", nowStr, "12:30", "อร่อยมาก", null, nowStr, "w1", null, null),
                Transaction("t3", "expense", 500.0, "ช้อปปิ้งและของใช้", "ห้างสรรพสินค้าสยาม", nowStr, "15:45", "ซื้ออุปกรณ์เครื่องเขียน", null, nowStr, "w3", null, null),
                Transaction("t4", "transfer", 2000.0, "อื่นๆ", "โอนเงินเข้าบัญชี", nowStr, "18:00", "ถอนเงินสดจากตู้ ATM", null, nowStr, "w2", "w1", null)
            )
            saveTransactions(context, defaults)
            return defaults
        }
        val type = object : TypeToken<List<Transaction>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
    }

    fun saveTransactions(context: Context, list: List<Transaction>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_TRANSACTIONS, gson.toJson(list)).apply()
    }

    fun getWallets(context: Context): List<Wallet> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_WALLETS, null)
        if (json == null) {
            val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaults = listOf(
                Wallet("w1", "เงินสด", "cash", 1500.0, "💵", "#10B981", null, nowStr, true),
                Wallet("w2", "บัญชีออมทรัพย์", "bank", 45000.0, "🏦", "#6366F1", "123-4-56789-0", nowStr, false),
                Wallet("w3", "บัตรเครดิต", "credit", -3200.0, "💳", "#EF4444", "4321", nowStr, false)
            )
            saveWallets(context, defaults)
            return defaults
        }
        val type = object : TypeToken<List<Wallet>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
    }

    fun saveWallets(context: Context, list: List<Wallet>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_WALLETS, gson.toJson(list)).apply()
    }

    fun getDebts(context: Context): List<Debt> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_DEBTS, null)
        if (json == null) {
            val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaults = listOf(
                Debt("d1", "borrowed", "คุณป้าพรรณ", 5000.0, 3000.0, "ยืมจ่ายค่าหอพัก", "2026-08-30", "active", nowStr),
                Debt("d2", "lent", "คุณเพื่อนซี้", 1500.0, 1500.0, "ยืมจ่ายค่าหมูกระทะ", "2026-07-28", "active", nowStr)
            )
            saveDebts(context, defaults)
            return defaults
        }
        val type = object : TypeToken<List<Debt>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
    }

    fun saveDebts(context: Context, list: List<Debt>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_DEBTS, gson.toJson(list)).apply()
    }

    fun getDebtPayments(context: Context): List<DebtPayment> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_DEBT_PAYMENTS, null)
        if (json == null) {
            val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
            val defaults = listOf(
                DebtPayment("dp1", "d1", 2000.0, "w1", nowStr, "คืนงวดแรก", nowStr)
            )
            saveDebtPayments(context, defaults)
            return defaults
        }
        val type = object : TypeToken<List<DebtPayment>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
    }

    fun saveDebtPayments(context: Context, list: List<DebtPayment>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_DEBT_PAYMENTS, gson.toJson(list)).apply()
    }

    fun clearAll(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().clear().apply()
    }
}
