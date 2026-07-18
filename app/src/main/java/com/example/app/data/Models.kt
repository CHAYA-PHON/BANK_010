package com.example.app.data

data class Transaction(
    val id: String,
    val type: String, // "income", "expense", "transfer"
    val amount: Double,
    val category: String,
    val merchantName: String,
    val date: String, // YYYY-MM-DD
    val time: String? = null, // HH:mm
    val note: String? = null,
    val imageUrl: String? = null, // Base64
    val createdAt: String,
    val walletId: String? = null,
    val toWalletId: String? = null,
    val debtId: String? = null
)

data class Wallet(
    val id: String,
    val name: String,
    val type: String, // "cash", "bank", "credit", "other"
    val initialBalance: Double,
    val icon: String, // Emoji symbol
    val color: String, // Hex code e.g. "#6366f1"
    val accountNumber: String? = null,
    val createdAt: String,
    val isDefault: Boolean = false
)

data class Debt(
    val id: String,
    val type: String, // "borrowed", "lent"
    val creditorDebtorName: String,
    val amount: Double,
    val remainingAmount: Double,
    val description: String? = null,
    val dueDate: String? = null, // YYYY-MM-DD
    val status: String, // "active", "paid"
    val createdAt: String
)

data class DebtPayment(
    val id: String,
    val debtId: String,
    val amount: Double,
    val walletId: String,
    val date: String,
    val note: String? = null,
    val createdAt: String
)

data class CategoryInfo(
    val name: String,
    val icon: String, // Emoji
    val colorHex: String,
    val textColorHex: String
)

val CATEGORIES = mapOf(
    "อาหารและเครื่องดื่ม" to CategoryInfo("อาหารและเครื่องดื่ม", "🍔", "#FFE082", "#E65100"),
    "ช้อปปิ้งและของใช้" to CategoryInfo("ช้อปปิ้งและของใช้", "🛍️", "#90CAF9", "#0D47A1"),
    "การเดินทางและยานพาหนะ" to CategoryInfo("การเดินทางและยานพาหนะ", "🚗", "#CE93D8", "#4A148C"),
    "ค่าสาธารณูปโภค" to CategoryInfo("ค่าสาธารณูปโภค", "💧", "#80DEEA", "#006064"),
    "ความบันเทิง" to CategoryInfo("ความบันเทิง", "🎬", "#F48FB1", "#880E4F"),
    "สุขภาพและความงาม" to CategoryInfo("สุขภาพและความงาม", "❤️", "#A5D6A7", "#1B5E20"),
    "ที่อยู่อาศัย" to CategoryInfo("ที่อยู่อาศัย", "🏠", "#FFCC80", "#E65100"),
    "เงินเดือนและรายได้" to CategoryInfo("เงินเดือนและรายได้", "💵", "#81C784", "#1B5E20"),
    "ชำระหนี้" to CategoryInfo("ชำระหนี้", "🏛️", "#EF9A9A", "#B71C1C"),
    "อื่นๆ" to CategoryInfo("อื่นๆ", "📦", "#B0BEC5", "#37474F")
)

val DEFAULT_CATEGORY_INFO = CategoryInfo("อื่นๆ", "📦", "#B0BEC5", "#37474F")
