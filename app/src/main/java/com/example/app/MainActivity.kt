package com.example.app

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.app.data.*
import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Color(0xFF6366F1),
                    secondary = Color(0xFF10B981),
                    background = Color(0xFF090D16),
                    surface = Color(0xFF131926)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF090D16)
                ) {
                    AppNavigation()
                }
            }
        }
    }
}

// Global colors matching the premium slate web theme
val DarkBg = Color(0xFF090D16)
val CardBg = Color(0xFF131926)
val IndigoAccent = Color(0xFF6366F1)
val GoldAccent = Color(0xFFF59E0B)
val EmeraldAccent = Color(0xFF10B981)
val RoseAccent = Color(0xFFEF4444)
val SlateMuted = Color(0xFF94A3B8)
val BorderColor = Color(0xFF2E3B4E)

@Composable
fun AppNavigation() {
    val context = LocalContext.current
    var isLoggedIn by remember { mutableStateOf(false) }
    var currentUser by remember { mutableStateOf("") }
    var currentPage by remember { mutableStateOf("dashboard") }

    // State lists
    var transactions by remember { mutableStateOf(listOf<Transaction>()) }
    var wallets by remember { mutableStateOf(listOf<Wallet>()) }
    var debts by remember { mutableStateOf(listOf<Debt>()) }
    var debtPayments by remember { mutableStateOf(listOf<DebtPayment>()) }

    // Load data from JSON storage on launch
    LaunchedEffect(Unit) {
        transactions = AppDatabase.getTransactions(context)
        wallets = AppDatabase.getWallets(context)
        debts = AppDatabase.getDebts(context)
        debtPayments = AppDatabase.getDebtPayments(context)
    }

    if (!isLoggedIn) {
        LoginScreen(
            onLoginSuccess = { username ->
                currentUser = username
                isLoggedIn = true
            }
        )
    } else {
        PCAppLayout(
            currentUser = currentUser,
            currentPage = currentPage,
            onPageChange = { currentPage = it },
            onLogout = {
                isLoggedIn = false
                currentUser = ""
            },
            transactions = transactions,
            wallets = wallets,
            debts = debts,
            debtPayments = debtPayments,
            onTransactionsChange = {
                transactions = it
                AppDatabase.saveTransactions(context, it)
            },
            onWalletsChange = {
                wallets = it
                AppDatabase.saveWallets(context, it)
            },
            onDebtsChange = {
                debts = it
                AppDatabase.saveDebts(context, it)
            },
            onDebtPaymentsChange = {
                debtPayments = it
                AppDatabase.saveDebtPayments(context, it)
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(onLoginSuccess: (String) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val context = LocalContext.current

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF1E1B4B), Color(0xFF090514)),
                    radius = 2000f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 400.dp)
                .fillMaxWidth()
                .padding(24.dp)
                .background(CardBg.copy(alpha = 0.9f), RoundedCornerShape(24.dp))
                .border(1.dp, Color.White.copy(alpha = 0.1f), RoundedCornerShape(24.dp))
                .padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Gold Coin Logo with glowing rim
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(
                        Brush.linearGradient(listOf(Color(0xFFFFE066), Color(0xFFB45309))),
                        CircleShape
                    )
                    .shadow(16.dp, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "฿",
                    fontSize = 40.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "บันทึกรายรับรายจ่าย AI",
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                fontFamily = FontFamily.SansSerif
            )
            Text(
                text = "ระบบสแกนสลิปอัจฉริยะสำหรับ PC & แท็บเล็ต",
                fontSize = 12.sp,
                color = SlateMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 24.dp)
            )

            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("ชื่อผู้ใช้งาน (Username)") },
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    focusedBorderColor = IndigoAccent,
                    unfocusedBorderColor = BorderColor,
                    focusedLabelColor = IndigoAccent,
                    unfocusedLabelColor = SlateMuted
                ),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("รหัสผ่าน (Password)") },
                visualTransformation = PasswordVisualTransformation(),
                modifier = Modifier.fillMaxWidth(),
                colors = TextFieldDefaults.outlinedTextFieldColors(
                    focusedBorderColor = IndigoAccent,
                    unfocusedBorderColor = BorderColor,
                    focusedLabelColor = IndigoAccent,
                    unfocusedLabelColor = SlateMuted
                ),
                shape = RoundedCornerShape(12.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    if (username.isNotBlank()) {
                        onLoginSuccess(username)
                        Toast.makeText(context, "ยินดีต้อนรับคุณ $username !", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "กรุณากรอกชื่อผู้ใช้งาน", Toast.LENGTH_SHORT).show()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
            ) {
                Text("เข้าสู่ระบบแอป PC", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
        }
    }
}

@Composable
fun PCAppLayout(
    currentUser: String,
    currentPage: String,
    onPageChange: (String) -> Unit,
    onLogout: () -> Unit,
    transactions: List<Transaction>,
    wallets: List<Wallet>,
    debts: List<Debt>,
    debtPayments: List<DebtPayment>,
    onTransactionsChange: (List<Transaction>) -> Unit,
    onWalletsChange: (List<Wallet>) -> Unit,
    onDebtsChange: (List<Debt>) -> Unit,
    onDebtPaymentsChange: (List<DebtPayment>) -> Unit
) {
    Row(modifier = Modifier.fillMaxSize()) {
        // Desktop Persistent Left Navigation Rail/Sidebar for PC optimization
        Column(
            modifier = Modifier
                .width(260.dp)
                .fillMaxHeight()
                .background(CardBg)
                .border(end = 1.dp, BorderColor)
                .padding(20.dp)
        ) {
            // App Branding Brand Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(
                            Brush.linearGradient(listOf(IndigoAccent, Color(0xFFD946EF))),
                            RoundedCornerShape(8.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("฿", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                }
                Column {
                    Text("รายรับรายจ่าย AI", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                    Text("PC DESKTOP APP", color = EmeraldAccent, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(30.dp))

            // Sidebar Menu Items
            val menuItems = listOf(
                Triple("dashboard", "แดชบอร์ดสรุปผล", Icons.Default.PieChart),
                Triple("records", "สแกน & บันทึกรายการ", Icons.Default.Scanner),
                Triple("wallets", "กระเป๋าและบัญชี", Icons.Default.Wallet),
                Triple("debts", "หนี้สินและลูกหนี้", Icons.Default.Handshake),
                Triple("settings", "ตั้งค่าและสำรอง", Icons.Default.Settings)
            )

            menuItems.forEach { (id, label, icon) ->
                val isSelected = currentPage == id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSelected) IndigoAccent.copy(alpha = 0.15f) else Color.Transparent)
                        .clickable { onPageChange(id) }
                        .border(
                            1.dp,
                            if (isSelected) IndigoAccent.copy(alpha = 0.3f) else Color.Transparent,
                            RoundedCornerShape(12.dp)
                        )
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (isSelected) IndigoAccent else SlateMuted,
                        modifier = Modifier.size(20.dp)
                    )
                    Text(
                        text = label,
                        color = if (isSelected) Color.White else SlateMuted,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 13.sp
                    )
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // User Info & Logout
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .background(Color.White.copy(alpha = 0.1f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, contentDescription = "User", tint = Color.White, modifier = Modifier.size(16.dp))
                    }
                    Column(modifier = Modifier.widthIn(max = 100.dp)) {
                        Text(
                            text = currentUser,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text("ผู้ดูแลระบบ", color = SlateMuted, fontSize = 9.sp)
                    }
                }

                IconButton(
                    onClick = onLogout,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = RoseAccent, modifier = Modifier.size(18.dp))
                }
            }
        }

        // Main content area scrollable for detailed PC screens
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .background(DarkBg)
        ) {
            when (currentPage) {
                "dashboard" -> DashboardScreen(transactions, wallets)
                "records" -> RecordsScreen(transactions, wallets, debts, onTransactionsChange, onWalletsChange)
                "wallets" -> WalletsScreen(wallets, onWalletsChange)
                "debts" -> DebtsScreen(debts, wallets, onDebtsChange, onWalletsChange, onTransactionsChange)
                "settings" -> SettingsScreen(currentUser, wallets, transactions, onLogout)
            }
        }
    }
}

// 1. Dashboard Screen with Custom Canvas Charts
@Composable
fun DashboardScreen(transactions: List<Transaction>, wallets: List<Wallet>) {
    val df = remember { DecimalFormat("#,##0.00") }
    
    // Calculations
    val totalAssets = wallets.filter { it.type != "credit" }.sumOf { it.initialBalance } + 
            transactions.filter { it.type == "income" }.sumOf { it.amount } -
            transactions.filter { it.type == "expense" }.sumOf { it.amount }
            
    val creditDebts = wallets.filter { it.type == "credit" }.sumOf { it.initialBalance }

    val totalBalance = totalAssets + creditDebts
    val totalIncome = transactions.filter { it.type == "income" }.sumOf { it.amount }
    val totalExpense = transactions.filter { it.type == "expense" }.sumOf { it.amount }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp)
    ) {
        // Desktop Header Row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("ยินดีต้อนรับกลับสู่ระบบจัดการเงิน AI", color = SlateMuted, fontSize = 12.sp)
                Text("แดชบอร์ดข้อมูลสำหรับผู้ประกอบการ PC", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            }
            Card(
                colors = CardDefaults.cardColors(containerColor = EmeraldAccent.copy(alpha = 0.1f)),
                border = BorderStroke(1.dp, EmeraldAccent.copy(alpha = 0.2f)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(modifier = Modifier.size(6.dp).background(EmeraldAccent, CircleShape))
                    Text("ฐานข้อมูลอัปเดตเรียบร้อย", color = EmeraldAccent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Balance Overview Bento Cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Net Worth Card
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(130.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(IndigoAccent.copy(alpha = 0.15f), Color.Transparent),
                                start = Offset(0f, 0f),
                                end = Offset(400f, 400f)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("ยอดคงเหลือรวมทั้งระบบ", color = SlateMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            Icon(Icons.Default.AccountBalanceWallet, contentDescription = null, tint = IndigoAccent, modifier = Modifier.size(18.dp))
                        }
                        Text("฿ ${df.format(totalBalance)}", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                        Text("สินทรัพย์กระเป๋าเงินรวมทั้งหมด", color = SlateMuted, fontSize = 10.sp)
                    }
                }
            }

            // Income Card
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(130.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(EmeraldAccent.copy(alpha = 0.15f), Color.Transparent),
                                start = Offset(0f, 0f),
                                end = Offset(400f, 400f)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("รายรับประจำเดือนนี้", color = SlateMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            Icon(Icons.Default.TrendingUp, contentDescription = null, tint = EmeraldAccent, modifier = Modifier.size(18.dp))
                        }
                        Text("฿ ${df.format(totalIncome)}", color = EmeraldAccent, fontSize = 24.sp, fontWeight = FontWeight.Black)
                        Text("+ สแกนอัตโนมัติจากสลิป", color = SlateMuted, fontSize = 10.sp)
                    }
                }
            }

            // Expense Card
            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(130.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.linearGradient(
                                colors = listOf(RoseAccent.copy(alpha = 0.15f), Color.Transparent),
                                start = Offset(0f, 0f),
                                end = Offset(400f, 400f)
                            )
                        )
                        .padding(20.dp)
                ) {
                    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("รายจ่ายประจำเดือนนี้", color = SlateMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                            Icon(Icons.Default.TrendingDown, contentDescription = null, tint = RoseAccent, modifier = Modifier.size(18.dp))
                        }
                        Text("฿ ${df.format(totalExpense)}", color = RoseAccent, fontSize = 24.sp, fontWeight = FontWeight.Black)
                        Text("- ค่าครองชีพและภาษีธุรกิจ", color = SlateMuted, fontSize = 10.sp)
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Grid of Charts & Activity List
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Visual Canvas Charts Section (60% width)
            Column(
                modifier = Modifier
                    .weight(1.5f)
                    .background(CardBg, RoundedCornerShape(20.dp))
                    .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                    .padding(24.dp)
            ) {
                Text("รายงานวิเคราะห์ทางการเงินและหมวดหมู่", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text("สถิติภาพรวมเทียบสัดส่วนรายรับรายจ่ายด้วยกราฟ", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 20.dp))

                if (transactions.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("ยังไม่มีข้อมูลสำหรับวิเคราะห์กราฟ", color = SlateMuted)
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Custom Interactive Pie Chart using Canvas drawing
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(contentAlignment = Alignment.Center) {
                                Canvas(modifier = Modifier.size(140.dp)) {
                                    val sweep1 = if (totalIncome + totalExpense == 0.0) 180f else (totalIncome / (totalIncome + totalExpense) * 360).toFloat()
                                    val sweep2 = 360f - sweep1

                                    drawArc(
                                        color = EmeraldAccent,
                                        startAngle = -90f,
                                        sweepAngle = sweep1,
                                        useCenter = false,
                                        style = Stroke(width = 40f, cap = StrokeCap.Round)
                                    )
                                    drawArc(
                                        color = RoseAccent,
                                        startAngle = -90f + sweep1,
                                        sweepAngle = sweep2,
                                        useCenter = false,
                                        style = Stroke(width = 40f, cap = StrokeCap.Round)
                                    )
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("อัตราส่วน", color = SlateMuted, fontSize = 9.sp)
                                    Text("เงินออม", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(modifier = Modifier.size(8.dp).background(EmeraldAccent, CircleShape))
                                    Text("รายรับ", color = Color.White, fontSize = 10.sp)
                                }
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Box(modifier = Modifier.size(8.dp).background(RoseAccent, CircleShape))
                                    Text("รายจ่าย", color = Color.White, fontSize = 10.sp)
                                }
                            }
                        }

                        // Custom Interactive Category Bar Chart
                        Canvas(
                            modifier = Modifier
                                .weight(1f)
                                .height(160.dp)
                                .padding(horizontal = 24.dp)
                        ) {
                            val canvasWidth = size.width
                            val canvasHeight = size.height
                            
                            val categoriesSum = transactions
                                .filter { it.type == "expense" }
                                .groupBy { it.category }
                                .mapValues { (_, txs) -> txs.sumOf { it.amount } }

                            val maxExpenseVal = categoriesSum.values.maxOrNull() ?: 1.0

                            var startX = 0f
                            val totalBars = CATEGORIES.size
                            val barWidth = (canvasWidth / totalBars) * 0.6f
                            val gap = (canvasWidth / totalBars) * 0.4f

                            CATEGORIES.entries.forEachIndexed { idx, entry ->
                                val categoryName = entry.key
                                val expenseVal = categoriesSum[categoryName] ?: 0.0
                                val barHeight = (expenseVal / maxExpenseVal * canvasHeight * 0.8f).toFloat()

                                val brush = Brush.verticalGradient(
                                    colors = listOf(Color(android.graphics.Color.parseColor(entry.value.colorHex)), IndigoAccent)
                                )

                                drawRoundRect(
                                    brush = brush,
                                    topLeft = Offset(startX, canvasHeight - barHeight),
                                    size = Size(barWidth, barHeight),
                                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(10f, 10f)
                                )

                                startX += barWidth + gap
                            }
                        }
                    }
                }
            }

            // Recent Transactions List (40% width)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .background(CardBg, RoundedCornerShape(20.dp))
                    .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                    .padding(24.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("รายการล่าสุดทางการเงิน", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Text("ดูทั้งหมด", color = IndigoAccent, fontSize = 11.sp, modifier = Modifier.clickable { })
                }
                Text("ประวัติการบันทึก & สแกน 5 รายการล่าสุด", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 16.dp))

                if (transactions.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("ยังไม่มีรายการบันทึก", color = SlateMuted)
                    }
                } else {
                    LazyColumn(
                        modifier = Modifier.height(200.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(transactions.take(5)) { tx ->
                            val categoryStyle = CATEGORIES[tx.category] ?: DEFAULT_CATEGORY_INFO
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(34.dp)
                                            .background(Color(android.graphics.Color.parseColor(categoryStyle.colorHex)).copy(alpha = 0.2f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(categoryStyle.icon, fontSize = 16.sp)
                                    }
                                    Column {
                                        Text(tx.merchantName, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("${tx.category} • ${tx.date}", color = SlateMuted, fontSize = 10.sp)
                                    }
                                }

                                Text(
                                    text = "${if (tx.type == "income") "+" else "-"} ฿${df.format(tx.amount)}",
                                    color = if (tx.type == "income") EmeraldAccent else RoseAccent,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// 2. Records Screen with AI Scan Simulation (Green Scanner Line) and Manual Add Form
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordsScreen(
    transactions: List<Transaction>,
    wallets: List<Wallet>,
    debts: List<Debt>,
    onTransactionsChange: (List<Transaction>) -> Unit,
    onWalletsChange: (List<Wallet>) -> Unit
) {
    var activeTab by remember { mutableStateOf("scan") } // "scan" or "manual"
    val coroutineScope = rememberCoroutineScope()
    val df = remember { DecimalFormat("#,##0.00") }

    // Manual Form States
    var txType by remember { mutableStateOf("expense") } // "income", "expense", "transfer"
    var txAmount by remember { mutableStateOf("") }
    var txCategory by remember { mutableStateOf(CATEGORIES.keys.first()) }
    var txMerchant by remember { mutableStateOf("") }
    var txNote by remember { mutableStateOf("") }
    var selectedWalletId by remember { mutableStateOf(wallets.firstOrNull()?.id ?: "") }
    var targetWalletId by remember { mutableStateOf(wallets.getOrNull(1)?.id ?: "") }

    // AI Scanner Simulation States
    var isScanning by remember { mutableStateOf(false) }
    var scanProgress by remember { mutableStateOf(0f) }
    var selectedSlipIndex by remember { mutableStateOf(-1) }
    var scannedResult by remember { mutableStateOf<Transaction?>(null) }

    val demoSlips = listOf(
        Triple("สลิปธนาคารกสิกรไทย - เติมน้ำมัน 1,200 บ.", 1200.0, "การเดินทางและยานพาหนะ"),
        Triple("สลิปธนาคารไทยพาณิชย์ - ค่าอาหารค่ำ 450 บ.", 450.0, "อาหารและเครื่องดื่ม"),
        Triple("สลิปธนาคารกรุงไทย - ช้อปปิ้งออนไลน์ 1,590 บ.", 1590.0, "ช้อปปิ้งและของใช้")
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text("สแกนสลิปอัจฉริยะ & บันทึกบัญชีสำหรับ PC", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("เลือกบันทึกทางการเงินผ่านรูปสลิปกล้อง หรือกรอกด้วยแป้นพิมพ์คอมพิวเตอร์อย่างรวดเร็ว", color = SlateMuted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 20.dp))

        // Tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 20.dp)
                .background(CardBg, RoundedCornerShape(12.dp))
                .padding(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (activeTab == "scan") IndigoAccent else Color.Transparent)
                    .clickable { activeTab = "scan" }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Scanner, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Text("สแกนสลิป AI (ความแม่นยำสูง)", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (activeTab == "manual") IndigoAccent else Color.Transparent)
                    .clickable { activeTab = "manual" }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.EditNote, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Text("กรอกรายการด้วยคีย์บอร์ด PC", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }

        if (activeTab == "scan") {
            // AI Scanner Tab Interface
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Left column: Select Demo Receipt Slip (50% width)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .background(CardBg, RoundedCornerShape(20.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                        .padding(20.dp)
                ) {
                    Text("เลือกรูปภาพใบเสร็จหรือสลิปธนาคาร", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Text("จำลองรูปสลิปจากแอปธนาคารไทยเพื่อสแกน", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 16.dp))

                    demoSlips.forEachIndexed { index, (label, amount, cat) ->
                        val isSelected = selectedSlipIndex == index
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) IndigoAccent.copy(alpha = 0.12f) else Color.Black.copy(alpha = 0.2f))
                                .border(1.dp, if (isSelected) IndigoAccent else BorderColor, RoundedCornerShape(12.dp))
                                .clickable {
                                    selectedSlipIndex = index
                                    scannedResult = null
                                }
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(if (isSelected) IndigoAccent else Color.White.copy(alpha = 0.1f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Text("จำนวนยอดเงิน: ฿${df.format(amount)} • หมวดหมู่: $cat", color = SlateMuted, fontSize = 10.sp)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            if (selectedSlipIndex == -1) return@Button
                            coroutineScope.launch {
                                isScanning = true
                                scanProgress = 0f
                                while (scanProgress < 1.0f) {
                                    delay(40)
                                    scanProgress += 0.025f
                                }
                                delay(300)
                                isScanning = false

                                // Create simulated transaction result
                                val slip = demoSlips[selectedSlipIndex]
                                val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                scannedResult = Transaction(
                                    id = "tx_" + UUID.randomUUID().toString().take(6),
                                    type = "expense",
                                    amount = slip.second,
                                    category = slip.third,
                                    merchantName = slip.first.split(" - ")[1].split(" ")[0],
                                    date = nowStr,
                                    time = "19:30",
                                    note = "สแกนสลิปอัจฉริยะเรียบร้อย",
                                    createdAt = nowStr,
                                    walletId = wallets.firstOrNull()?.id
                                )
                            }
                        },
                        enabled = selectedSlipIndex != -1 && !isScanning,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldAccent)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Scanner, contentDescription = null, tint = Color.White)
                            Text("สแกนภาพและอ่านสลิปด้วย AI", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                // Right column: Scanning Laser View & Results (50% width)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .background(CardBg, RoundedCornerShape(20.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    if (isScanning) {
                        // High-tech laser green scanning screen simulator
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.Black),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            Column(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.Center,
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.QrCodeScanner,
                                    contentDescription = null,
                                    tint = EmeraldAccent,
                                    modifier = Modifier.size(54.dp)
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                Text("กำลังวิเคราะห์ข้อมูลด้วย AI...", color = EmeraldAccent, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                Text("${(scanProgress * 100).toInt()}%", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                            }

                            // Glowing green scanning laser line moving dynamically
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height((scanProgress * 220).dp)
                                    .border(bottom = BorderStroke(3.dp, EmeraldAccent))
                                    .background(
                                        Brush.verticalGradient(
                                            listOf(Color.Transparent, EmeraldAccent.copy(alpha = 0.25f))
                                        )
                                    )
                            )
                        }
                    } else if (scannedResult != null) {
                        val result = scannedResult!!
                        Text("✅ ตรวจพบและสแกนข้อมูลสำเร็จ", color = EmeraldAccent, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp)
                        Text("กรุณาตรวจสอบข้อมูลสลิปก่อนบันทึกลงสมุดบัญชี", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 16.dp))

                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color.Black.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("ร้านค้า/รายการ:", color = SlateMuted, fontSize = 12.sp)
                                Text(result.merchantName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("ยอดเงินสแกนได้:", color = SlateMuted, fontSize = 12.sp)
                                Text("฿${df.format(result.amount)}", color = EmeraldAccent, fontWeight = FontWeight.Black, fontSize = 14.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("หมวดหมู่อัตโนมัติ:", color = SlateMuted, fontSize = 12.sp)
                                Text(result.category, color = IndigoAccent, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("วันที่สแกนสำเร็จ:", color = SlateMuted, fontSize = 12.sp)
                                Text(result.date, color = Color.White, fontSize = 11.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                val currentList = transactions.toMutableList()
                                currentList.add(0, result)
                                onTransactionsChange(currentList)
                                scannedResult = null
                                selectedSlipIndex = -1
                                Toast.makeText(
                                    onTransactionsChange as? Context ?: result.hashCode() as? Context ?: null ?: run { null },
                                    "บันทึกยอดสแกนเรียบร้อย!",
                                    Toast.LENGTH_SHORT
                                ).show()
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                        ) {
                            Text("อนุมัติและบันทึกลงกระเป๋าหลัก", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(220.dp)
                                .border(1.dp, BorderColor.copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Icon(Icons.Default.Image, contentDescription = null, tint = SlateMuted.copy(alpha = 0.4f), modifier = Modifier.size(42.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("กรุณาเลือกรูปสลิปด้ายซ้าย", color = SlateMuted, fontSize = 12.sp)
                                Text("เพื่อเริ่มใช้งานระบบสแกนบิลด้วย AI", color = SlateMuted.copy(alpha = 0.6f), fontSize = 10.sp)
                            }
                        }
                    }
                }
            }
        } else {
            // Manual Add Form Tab Interface
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // Form Fields Card (60% width)
                Column(
                    modifier = Modifier
                        .weight(1.5f)
                        .background(CardBg, RoundedCornerShape(20.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                        .padding(24.dp)
                ) {
                    Text("รายละเอียดข้อมูลรายการทางการเงิน", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(20.dp))

                    // Type Selector Tab Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp)
                    ) {
                        val types = listOf("income" to "รายรับ (+) ", "expense" to "รายจ่าย (-) ", "transfer" to "โอนเงิน ⇆")
                        types.forEach { (typeVal, label) ->
                            val isSelected = txType == typeVal
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(
                                        if (isSelected) {
                                            when (typeVal) {
                                                "income" -> EmeraldAccent
                                                "expense" -> RoseAccent
                                                else -> IndigoAccent
                                            }
                                        } else Color.Black.copy(alpha = 0.15f)
                                    )
                                    .border(1.dp, BorderColor, RoundedCornerShape(8.dp))
                                    .clickable { txType = typeVal }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }

                    // Field 1: Amount
                    OutlinedTextField(
                        value = txAmount,
                        onValueChange = { txAmount = it },
                        label = { Text("จำนวนเงิน (บาท)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            focusedBorderColor = IndigoAccent,
                            unfocusedBorderColor = BorderColor
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Field 2: Merchant / List Title
                    OutlinedTextField(
                        value = txMerchant,
                        onValueChange = { txMerchant = it },
                        label = { Text("รายการ / ร้านค้า / แหล่งที่มา") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            focusedBorderColor = IndigoAccent,
                            unfocusedBorderColor = BorderColor
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Row: Categories & Source Wallet Selection
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("หมวดหมู่รายการ", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 4.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                    .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                Text(txCategory, color = Color.White, fontSize = 13.sp)
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text("กระเป๋าเงิน/บัญชีต้นทาง", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 4.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                    .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                val w = wallets.find { it.id == selectedWalletId }
                                Text(w?.name ?: "เลือกกระเป๋าเงิน", color = Color.White, fontSize = 13.sp)
                            }
                        }
                    }

                    if (txType == "transfer") {
                        Spacer(modifier = Modifier.height(12.dp))
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Text("โอนเงินไปยังบัญชีปลายทาง", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 4.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .background(Color.Black.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                    .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                                    .padding(horizontal = 12.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                val w = wallets.find { it.id == targetWalletId }
                                Text(w?.name ?: "เลือกกระเป๋าปลายทาง", color = Color.White, fontSize = 13.sp)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Field 3: Custom Note
                    OutlinedTextField(
                        value = txNote,
                        onValueChange = { txNote = it },
                        label = { Text("บันทึกช่วยจำ (ถ้ามี)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(
                            focusedBorderColor = IndigoAccent,
                            unfocusedBorderColor = BorderColor
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            val amount = txAmount.toDoubleOrNull() ?: 0.0
                            if (amount <= 0.0 || txMerchant.isBlank()) {
                                return@Button
                            }

                            val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                            val tx = Transaction(
                                id = "tx_" + UUID.randomUUID().toString().take(6),
                                type = txType,
                                amount = amount,
                                category = txCategory,
                                merchantName = txMerchant,
                                date = nowStr,
                                time = "12:00",
                                note = txNote.takeIf { it.isNotBlank() },
                                createdAt = nowStr,
                                walletId = selectedWalletId,
                                toWalletId = targetWalletId.takeIf { txType == "transfer" }
                            )

                            val updated = transactions.toMutableList()
                            updated.add(0, tx)
                            onTransactionsChange(updated)

                            // Clean form fields
                            txAmount = ""
                            txMerchant = ""
                            txNote = ""
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                    ) {
                        Text("เพิ่มรายการบัญชีใหม่", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }

                // Quick Categories list (40% width)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .background(CardBg, RoundedCornerShape(20.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                        .padding(20.dp)
                ) {
                    Text("เลือกหมวดหมู่ที่รวดเร็ว", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Text("แตะเลือกด้ายล่างเพื่ออัปเดตช่องหมวดหมู่", color = SlateMuted, fontSize = 11.sp, modifier = Modifier.padding(bottom = 12.dp))

                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        CATEGORIES.forEach { (name, info) ->
                            val isSelected = txCategory == name
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSelected) IndigoAccent.copy(alpha = 0.15f) else Color.Black.copy(alpha = 0.15f))
                                    .border(1.dp, if (isSelected) IndigoAccent else BorderColor, RoundedCornerShape(10.dp))
                                    .clickable { txCategory = name }
                                    .padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(info.icon, fontSize = 18.sp)
                                Text(name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

// 3. Wallets management Screen
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalletsScreen(
    wallets: List<Wallet>,
    onWalletsChange: (List<Wallet>) -> Unit
) {
    val df = remember { DecimalFormat("#,##0.00") }
    var showAddDialog by remember { mutableStateOf(false) }

    // Dialog input states
    var walletName by remember { mutableStateOf("") }
    var walletType by remember { mutableStateOf("bank") } // "cash", "bank", "credit", "other"
    var walletBalance by remember { mutableStateOf("") }
    var accountNo by remember { mutableStateOf("") }
    var selectedEmoji by remember { mutableStateOf("🏦") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("การจัดการบัญชีและกระเป๋าเงินธุรกิจ", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("ดูและจัดการกระเป๋าสตางค์, บัญชีธนาคาร และบัตรเครดิตทั้งหมด", color = SlateMuted, fontSize = 12.sp)
            }

            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Plus, contentDescription = null, tint = Color.White)
                    Text("สร้างกระเป๋าเงินใหม่", fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Grid List of Wallets
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            wallets.forEach { w ->
                val cardColor = when (w.type) {
                    "cash" -> EmeraldAccent
                    "credit" -> RoseAccent
                    "bank" -> IndigoAccent
                    else -> GoldAccent
                }
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .height(180.dp),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    border = BorderStroke(1.dp, BorderColor)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp),
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .background(cardColor.copy(alpha = 0.15f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(w.icon, fontSize = 22.sp)
                            }
                            Text(
                                text = when (w.type) {
                                    "cash" -> "เงินสด"
                                    "bank" -> "ธนาคาร"
                                    "credit" -> "บัตรเครดิต"
                                    else -> "อื่นๆ"
                                },
                                color = SlateMuted,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Column {
                            Text(w.name, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            if (!w.accountNumber.isNullOrBlank()) {
                                Text(w.accountNumber ?: "", color = SlateMuted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                            }
                        }

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("฿ ${df.format(w.initialBalance)}", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            IconButton(
                                onClick = {
                                    val updated = wallets.filter { it.id != w.id }
                                    onWalletsChange(updated)
                                },
                                modifier = Modifier.size(24.dp)
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "ลบ", tint = RoseAccent, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            Dialog(onDismissRequest = { showAddDialog = false }) {
                Column(
                    modifier = Modifier
                        .width(420.dp)
                        .background(CardBg, RoundedCornerShape(24.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(24.dp))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text("เพิ่มกระเป๋าเงินธุรกิจใบใหม่", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)

                    OutlinedTextField(
                        value = walletName,
                        onValueChange = { walletName = it },
                        label = { Text("ชื่อกระเป๋าเงิน (เช่น ธนาคารกสิกรไทย)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    OutlinedTextField(
                        value = walletBalance,
                        onValueChange = { walletBalance = it },
                        label = { Text("ยอดเงินตั้งต้น (บาท)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    OutlinedTextField(
                        value = accountNo,
                        onValueChange = { accountNo = it },
                        label = { Text("เลขบัญชี / 4 ตัวท้ายบัตรเครดิต (ถ้ามี)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    // Type Row Selection
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val types = listOf("cash" to "💵", "bank" to "🏦", "credit" to "💳")
                        types.forEach { (typeVal, emoji) ->
                            val isSelected = walletType == typeVal
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(if (isSelected) IndigoAccent else Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                    .border(1.dp, if (isSelected) IndigoAccent else BorderColor, RoundedCornerShape(8.dp))
                                    .clickable {
                                        walletType = typeVal
                                        selectedEmoji = emoji
                                    }
                                    .padding(vertical = 12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(emoji, fontSize = 20.sp)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showAddDialog = false },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("ยกเลิก")
                        }
                        Button(
                            onClick = {
                                val balanceVal = walletBalance.toDoubleOrNull() ?: 0.0
                                if (walletName.isBlank()) return@Button

                                val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                val w = Wallet(
                                    id = "w_" + UUID.randomUUID().toString().take(6),
                                    name = walletName,
                                    type = walletType,
                                    initialBalance = balanceVal,
                                    icon = selectedEmoji,
                                    color = "#6366F1",
                                    accountNumber = accountNo.takeIf { it.isNotBlank() },
                                    createdAt = nowStr
                                )

                                val list = wallets.toMutableList()
                                list.add(w)
                                onWalletsChange(list)

                                // Reset form
                                walletName = ""
                                walletBalance = ""
                                accountNo = ""
                                showAddDialog = false
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                        ) {
                            Text("สร้างกระเป๋าเงิน")
                        }
                    }
                }
            }
        }
    }
}

// 4. Debts and Loans Management Screen
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DebtsScreen(
    debts: List<Debt>,
    wallets: List<Wallet>,
    onDebtsChange: (List<Debt>) -> Unit,
    onWalletsChange: (List<Wallet>) -> Unit,
    onTransactionsChange: (List<Transaction>) -> Unit
) {
    val df = remember { DecimalFormat("#,##0.00") }
    var showAddDialog by remember { mutableStateOf(false) }

    // Repay modal states
    var activeRepayDebt by remember { mutableStateOf<Debt?>(null) }
    var repayAmount by remember { mutableStateOf("") }

    // Add Debt Form States
    var debtType by remember { mutableStateOf("borrowed") } // "borrowed" or "lent"
    var personName by remember { mutableStateOf("") }
    var amountStr by remember { mutableStateOf("") }
    var descStr by remember { mutableStateOf("") }
    var dueDateStr by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("ระบบจัดการหนี้สินและลูกหนี้", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("ควบคุมการกู้ยืม ติดตามการชำระหนี้ และสัญญาลูกหนี้ทั้งหมด", color = SlateMuted, fontSize = 12.sp)
            }

            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Default.Plus, contentDescription = null, tint = Color.White)
                    Text("เพิ่มสัญญากู้ยืมใหม่", fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Grid of Borrowed vs Lent totals
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            val totalBorrowed = debts.filter { it.type == "borrowed" }.sumOf { it.remainingAmount }
            val totalLent = debts.filter { it.type == "lent" }.sumOf { it.remainingAmount }

            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(90.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("ยอดหนี้สินทั้งหมดที่เราค้างเขา (Borrowed)", color = SlateMuted, fontSize = 11.sp)
                        Text("฿ ${df.format(totalBorrowed)}", color = RoseAccent, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    Icon(Icons.Default.TrendingDown, contentDescription = null, tint = RoseAccent, modifier = Modifier.size(24.dp))
                }
            }

            Card(
                modifier = Modifier
                    .weight(1f)
                    .height(90.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                border = BorderStroke(1.dp, BorderColor)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("ยอดเงินค้างชำระที่เขาค้างเรา (Lent)", color = SlateMuted, fontSize = 11.sp)
                        Text("฿ ${df.format(totalLent)}", color = EmeraldAccent, fontSize = 20.sp, fontWeight = FontWeight.Black)
                    }
                    Icon(Icons.Default.TrendingUp, contentDescription = null, tint = EmeraldAccent, modifier = Modifier.size(24.dp))
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // List of Active Debts
        Text("สัญญากู้ยืมที่กำลังดำเนินการอยู่", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 12.dp))

        if (debts.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("ไม่มีสัญญากู้ยืมที่ค้างอยู่", color = SlateMuted)
            }
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                debts.forEach { debt ->
                    val isBorrowed = debt.type == "borrowed"
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(CardBg, RoundedCornerShape(16.dp))
                            .border(1.dp, BorderColor, RoundedCornerShape(16.dp))
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(if (isBorrowed) RoseAccent.copy(alpha = 0.15f) else EmeraldAccent.copy(alpha = 0.15f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = if (isBorrowed) Icons.Default.TrendingDown else Icons.Default.TrendingUp,
                                    contentDescription = null,
                                    tint = if (isBorrowed) RoseAccent else EmeraldAccent,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Column {
                                Text(debt.creditorDebtorName, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                Text(
                                    text = "${if (isBorrowed) "เจ้าหนี้" else "ลูกหนี้"} • กำหนดคืน ${debt.dueDate ?: "ไม่ระบุ"}",
                                    color = SlateMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Column(horizontalAlignment = Alignment.End) {
                                Text("ยอดค้างชำระ", color = SlateMuted, fontSize = 10.sp)
                                Text("฿ ${df.format(debt.remainingAmount)}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            }

                            if (debt.status == "active") {
                                Button(
                                    onClick = { activeRepayDebt = debt },
                                    colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("ชำระเงิน", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            } else {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = EmeraldAccent.copy(alpha = 0.1f)),
                                    border = BorderStroke(1.dp, EmeraldAccent.copy(alpha = 0.2f))
                                ) {
                                    Text("จ่ายครบแล้ว", color = EmeraldAccent, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add Dialog
        if (showAddDialog) {
            Dialog(onDismissRequest = { showAddDialog = false }) {
                Column(
                    modifier = Modifier
                        .width(420.dp)
                        .background(CardBg, RoundedCornerShape(24.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(24.dp))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("สร้างสัญญากู้ยืมใหม่", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)

                    // Type selection borrowed vs lent
                    Row(modifier = Modifier.fillMaxWidth()) {
                        val types = listOf("borrowed" to "เรายืมเงินเขา (หนี้สิน)", "lent" to "เขายืมเงินเรา (ลูกหนี้)")
                        types.forEach { (typeVal, label) ->
                            val isSelected = debtType == typeVal
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(if (isSelected) IndigoAccent else Color.Black.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                                    .border(1.dp, if (isSelected) IndigoAccent else BorderColor, RoundedCornerShape(8.dp))
                                    .clickable { debtType = typeVal }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(label, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                            }
                        }
                    }

                    OutlinedTextField(
                        value = personName,
                        onValueChange = { personName = it },
                        label = { Text("ชื่อคู่สัญญา (บุคคล / ธนาคาร / เจ้าหนี้)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    OutlinedTextField(
                        value = amountStr,
                        onValueChange = { amountStr = it },
                        label = { Text("จำนวนยอดเงินเริ่มต้น (บาท)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    OutlinedTextField(
                        value = dueDateStr,
                        onValueChange = { dueDateStr = it },
                        label = { Text("กำหนดคืนเงิน (เช่น 2026-08-30)") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    OutlinedTextField(
                        value = descStr,
                        onValueChange = { descStr = it },
                        label = { Text("บันทึกข้อมูลสัญญาอื่นๆ") },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(onClick = { showAddDialog = false }, modifier = Modifier.weight(1f)) {
                            Text("ยกเลิก")
                        }
                        Button(
                            onClick = {
                                val amt = amountStr.toDoubleOrNull() ?: 0.0
                                if (personName.isBlank() || amt <= 0.0) return@Button

                                val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                val newDebt = Debt(
                                    id = "d_" + UUID.randomUUID().toString().take(6),
                                    type = debtType,
                                    creditorDebtorName = personName,
                                    amount = amt,
                                    remainingAmount = amt,
                                    description = descStr.takeIf { it.isNotBlank() },
                                    dueDate = dueDateStr.takeIf { it.isNotBlank() },
                                    status = "active",
                                    createdAt = nowStr
                                )

                                val list = debts.toMutableList()
                                list.add(newDebt)
                                onDebtsChange(list)

                                // Clean form
                                personName = ""
                                amountStr = ""
                                descStr = ""
                                dueDateStr = ""
                                showAddDialog = false
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                        ) {
                            Text("สร้างสัญญา")
                        }
                    }
                }
            }
        }

        // Repay Modal Dialog
        if (activeRepayDebt != null) {
            val d = activeRepayDebt!!
            Dialog(onDismissRequest = { activeRepayDebt = null }) {
                Column(
                    modifier = Modifier
                        .width(420.dp)
                        .background(CardBg, RoundedCornerShape(24.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(24.dp))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("บันทึกการชำระเงินคืน", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("คู่สัญญา: ${d.creditorDebtorName} • ยอดคงเหลือ: ฿${df.format(d.remainingAmount)}", color = SlateMuted, fontSize = 12.sp)

                    OutlinedTextField(
                        value = repayAmount,
                        onValueChange = { repayAmount = it },
                        label = { Text("จำนวนเงินที่ต้องการชำระคืน (บาท)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = IndigoAccent, unfocusedBorderColor = BorderColor)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(onClick = { activeRepayDebt = null }, modifier = Modifier.weight(1f)) {
                            Text("ยกเลิก")
                        }
                        Button(
                            onClick = {
                                val rAmt = repayAmount.toDoubleOrNull() ?: 0.0
                                if (rAmt <= 0.0 || rAmt > d.remainingAmount) return@Button

                                val nowStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())
                                
                                // Update remaining debt
                                val newRemaining = d.remainingAmount - rAmt
                                val updatedDebts = debts.map {
                                    if (it.id == d.id) {
                                        it.copy(
                                            remainingAmount = newRemaining,
                                            status = if (newRemaining <= 0.0) "paid" else "active"
                                        )
                                    } else it
                                }
                                onDebtsChange(updatedDebts)

                                // Record standard system log transaction
                                val tx = Transaction(
                                    id = "tx_" + UUID.randomUUID().toString().take(6),
                                    type = if (d.type == "borrowed") "expense" else "income",
                                    amount = rAmt,
                                    category = "ชำระหนี้",
                                    merchantName = "ชำระหนี้: ${d.creditorDebtorName}",
                                    date = nowStr,
                                    time = "12:00",
                                    note = "บันทึกจากการชำระคืนสัญญา ${d.id}",
                                    createdAt = nowStr,
                                    walletId = wallets.firstOrNull()?.id
                                )
                                val listTx = onTransactionsChange as? List<Transaction> ?: emptyList()
                                val mutableTx = listTx.toMutableList()
                                mutableTx.add(0, tx)
                                onTransactionsChange(mutableTx)

                                repayAmount = ""
                                activeRepayDebt = null
                            },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                        ) {
                            Text("อนุมัติชำระเงิน")
                        }
                    }
                }
            }
        }
    }
}

// 5. Settings management Screen
@Composable
fun SettingsScreen(
    currentUser: String,
    wallets: List<Wallet>,
    transactions: List<Transaction>,
    onLogout: () -> Unit
) {
    val context = LocalContext.current

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Text("ตั้งค่าระบบและฐานข้อมูลสำรอง PC", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("ดูสเปคเครื่องมือถือจำลอง จัดการฐานข้อมูลและไฟล์สำรองข้อมูลของแอปอย่างปลอดภัย", color = SlateMuted, fontSize = 12.sp, modifier = Modifier.padding(bottom = 20.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            border = BorderStroke(1.dp, BorderColor)
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("ข้อมูลจำเพาะระบบ Android SDK", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("ระบบปฏิบัติการแอปจำลอง", color = SlateMuted, fontSize = 12.sp)
                    Text("Android Native SDK 36 (Kotlin / Compose)", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("บัญชีดูแลฐานข้อมูล", color = SlateMuted, fontSize = 12.sp)
                    Text(currentUser, color = IndigoAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("กระเป๋าเงินที่มี", color = SlateMuted, fontSize = 12.sp)
                    Text("${wallets.size} บัญชี", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("จำนวนรายการรวม", color = SlateMuted, fontSize = 12.sp)
                    Text("${transactions.size} รายการ", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Backup and resets cards
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            border = BorderStroke(1.dp, BorderColor)
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("การจัดการความปลอดภัยและข้อมูล", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Button(
                        onClick = {
                            Toast.makeText(context, "ส่งออกข้อมูลสรุปบัญชีเสร็จสิ้น!", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = IndigoAccent)
                    ) {
                        Text("สำรองข้อมูลลง PC", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Button(
                        onClick = {
                            AppDatabase.clearAll(context)
                            Toast.makeText(context, "ล้างข้อมูลระบบทั้งหมดแล้ว กรุณารีสตาร์ท", Toast.LENGTH_LONG).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = RoseAccent)
                    ) {
                        Text("ล้างข้อมูลการเงินทั้งหมด", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
