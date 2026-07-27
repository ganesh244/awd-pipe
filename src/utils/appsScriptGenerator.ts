export const CODE_GS = `/**
 * AWD Pipe QR-Based Farmer Registration and Monitoring System
 * Backend Google Apps Script (Code.gs)
 * 
 * Handles Web App HTTP GET requests, server-side validations,
 * concurrency locking via LockService, and Google Sheet CRUD operations.
 */

// Sheet Tab Names
const SHEET_PIPES = "AWD_Pipes";
const SHEET_INSTALLATIONS = "Installations";
const SHEET_MONITORING = "Monitoring";

/**
 * Serves the HTML Web App interface when a QR code or Web App link is accessed
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile("Index");
  
  // Extract Pipe ID from URL parameter e.g., ?id=AWD-0001
  var pipeId = (e && e.parameter && e.parameter.id) ? e.parameter.id.trim() : "";
  template.initialPipeId = pipeId;
  
  return template.evaluate()
    .setTitle("AWD Pipe Registration & Monitoring System")
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Includes external HTML files (for CSS/JS modularity if needed)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Fetch Pipe Details & Registration Status
 * Validates against AWD_Pipes and checks for existing registration in Installations
 */
function getPipeDetails(pipeId) {
  if (!pipeId) {
    return { success: false, message: "No Pipe ID provided." };
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Verify pipe exists in AWD_Pipes master sheet
  var pipesSheet = ss.getSheetByName(SHEET_PIPES);
  if (!pipesSheet) {
    return { success: false, message: "AWD_Pipes sheet not found. Please run system setup." };
  }
  
  var pipesData = pipesSheet.getDataRange().getValues();
  var pipeFound = false;
  var pipeMasterStatus = "Available";
  
  for (var i = 1; i < pipesData.length; i++) {
    if (pipesData[i][0] === pipeId) { // Column A: Pipe_ID
      pipeFound = true;
      pipeMasterStatus = pipesData[i][4] || "Available"; // Column E: Status
      break;
    }
  }
  
  if (!pipeFound) {
    return { success: false, message: "Invalid Pipe ID '" + pipeId + "'. Pipe ID not found in master records." };
  }
  
  // 2. Check if already installed in Installations sheet
  var instSheet = ss.getSheetByName(SHEET_INSTALLATIONS);
  if (instSheet && instSheet.getLastRow() > 1) {
    var instData = instSheet.getDataRange().getValues();
    for (var j = 1; j < instData.length; j++) {
      if (instData[j][1] === pipeId) { // Column B: Pipe_ID
        // Existing installation found! Mask sensitive data for public view.
        var row = instData[j];
        var fullMobile = String(row[3] || "");
        var maskedMobile = fullMobile.length >= 10 ? fullMobile.substring(0, 2) + "******" + fullMobile.substring(8) : "******";
        
        return {
          success: true,
          isRegistered: true,
          installation: {
            pipeId: row[1],
            farmerName: row[2],
            maskedMobile: maskedMobile,
            village: row[5],
            mandal: row[6],
            district: row[7],
            plotSize: row[9] + " " + row[10],
            crop: row[11],
            variety: row[12] || "N/A",
            establishmentMethod: row[13],
            sowingDate: formatDate(row[14]),
            installationDate: formatDate(row[17]),
            locationLink: row[21],
            installedBy: row[22]
          }
        };
      }
    }
  }
  
  // If not registered yet
  return {
    success: true,
    isRegistered: false,
    pipeId: pipeId,
    status: pipeMasterStatus
  };
}

/**
 * Registers a new AWD Pipe Installation with LockService concurrency protection
 */
function registerInstallation(data) {
  var lock = LockService.getScriptLock();
  try {
    // Wait up to 10 seconds for concurrent requests to complete
    if (!lock.waitLock(10000)) {
      return { success: false, message: "System busy processing another registration. Please try again in a few seconds." };
    }
    
    // Server-side field validation
    if (!data.pipeId || !data.farmerName || !data.mobile || !data.village || !data.mandal || !data.district || !data.plotSize || !data.establishmentMethod || !data.sowingDate || !data.irrigationSource || !data.installationDate || !data.installedBy) {
      return { success: false, message: "Please fill in all required fields marked with *." };
    }
    
    // Validate Indian Mobile Number (10 digits starting with 6-9)
    var mobileClean = String(data.mobile).trim().replace(/\\D/g, "");
    if (!/^[6-9]\\d{9}$/.test(mobileClean)) {
      return { success: false, message: "Invalid mobile number. Please enter a valid 10-digit Indian mobile number." };
    }
    
    // Validate GPS Coordinates
    if (!data.latitude || !data.longitude) {
      return { success: false, message: "GPS Location is required. Please capture GPS location before submitting." };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Verify Pipe exists in AWD_Pipes master sheet
    var pipesSheet = ss.getSheetByName(SHEET_PIPES);
    var pipesData = pipesSheet.getDataRange().getValues();
    var pipeRowIndex = -1;
    
    for (var i = 1; i < pipesData.length; i++) {
      if (pipesData[i][0] === data.pipeId) {
        pipeRowIndex = i + 1; // 1-based index in sheet
        break;
      }
    }
    
    if (pipeRowIndex === -1) {
      return { success: false, message: "Invalid Pipe ID '" + data.pipeId + "'. Not found in master database." };
    }
    
    // Verify NOT already registered in Installations
    var instSheet = ss.getSheetByName(SHEET_INSTALLATIONS);
    if (!instSheet) {
      instSheet = ss.insertSheet(SHEET_INSTALLATIONS);
    }
    
    if (instSheet.getLastRow() > 1) {
      var existing = instSheet.getDataRange().getValues();
      for (var k = 1; k < existing.length; k++) {
        if (existing[k][1] === data.pipeId) {
          return { success: false, message: "This AWD Pipe (" + data.pipeId + ") has ALREADY been registered!" };
        }
      }
    }
    
    // Generate location link
    var locationLink = "https://www.google.com/maps?q=" + data.latitude + "," + data.longitude;
    var timestamp = new Date();
    
    // Append to Installations Sheet
    // Columns: Timestamp, Pipe_ID, Farmer_Name, Mobile, Farmer_ID, Village, Mandal, District, Survey_No, Plot_Size, Plot_Size_Unit, Crop, Variety, Establishment_Method, Sowing_Transplantation_Date, Nursery_Sowing_Date, Irrigation_Source, Installation_Date, Latitude, Longitude, GPS_Accuracy, Location_Link, Installed_By, Remarks
    instSheet.appendRow([
      timestamp,
      data.pipeId,
      data.farmerName.trim(),
      mobileClean,
      data.farmerId ? data.farmerId.trim() : "",
      data.village.trim(),
      data.mandal.trim(),
      data.district.trim(),
      data.surveyNo ? data.surveyNo.trim() : "",
      Number(data.plotSize),
      data.plotSizeUnit || "Acres",
      data.crop || "Paddy",
      data.variety ? data.variety.trim() : "",
      data.establishmentMethod,
      data.sowingDate,
      data.establishmentMethod === "TPR" ? (data.nurserySowingDate || "") : "",
      data.irrigationSource === "Other" ? "Other (" + (data.irrigationSourceOther || "") + ")" : data.irrigationSource,
      data.installationDate,
      data.latitude,
      data.longitude,
      data.gpsAccuracy || 0,
      locationLink,
      data.installedBy.trim(),
      data.remarks ? data.remarks.trim() : ""
    ]);
    
    // Update AWD_Pipes master sheet status to Installed
    // Pipe_ID (col 1), Batch_No (col 2), QR_URL (col 3), QR_Code (col 4), Status (col 5), Installation_Date (col 6), Farmer_Name (col 7), Village (col 8)
    pipesSheet.getRange(pipeRowIndex, 5).setValue("Installed");
    pipesSheet.getRange(pipeRowIndex, 6).setValue(data.installationDate);
    pipesSheet.getRange(pipeRowIndex, 7).setValue(data.farmerName.trim());
    pipesSheet.getRange(pipeRowIndex, 8).setValue(data.village.trim());
    
    return {
      success: true,
      message: "AWD Pipe registered successfully!",
      record: {
        pipeId: data.pipeId,
        farmerName: data.farmerName.trim(),
        village: data.village.trim(),
        plotSize: data.plotSize + " " + (data.plotSizeUnit || "Acres"),
        establishmentMethod: data.establishmentMethod,
        installationDate: data.installationDate
      }
    };
    
  } catch (err) {
    return { success: false, message: "Server Error: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Records a field monitoring visit for an installed AWD pipe
 */
function addMonitoringVisit(data) {
  var lock = LockService.getScriptLock();
  try {
    if (!lock.waitLock(10000)) {
      return { success: false, message: "System busy. Please retry submitting monitoring visit." };
    }
    
    if (!data.pipeId || !data.visitDate || !data.visitedBy || !data.waterLevel) {
      return { success: false, message: "Please fill in all required monitoring fields." };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var monSheet = ss.getSheetByName(SHEET_MONITORING);
    if (!monSheet) {
      monSheet = ss.insertSheet(SHEET_MONITORING);
    }
    
    var timestamp = new Date();
    
    // Columns: Timestamp, Pipe_ID, Visit_Date, Water_Level, Crop_Stage, AWD_Followed, Pipe_Condition, Visited_By, Latitude, Longitude, Remarks
    monSheet.appendRow([
      timestamp,
      data.pipeId,
      data.visitDate,
      data.waterLevel,
      data.cropStage || "Tillering",
      data.awdFollowed || "Yes",
      data.pipeCondition || "Good",
      data.visitedBy.trim(),
      data.latitude || "",
      data.longitude || "",
      data.remarks ? data.remarks.trim() : ""
    ]);
    
    // If pipe condition is reported as Damaged/Missing/Replaced, update AWD_Pipes master status
    if (data.pipeCondition && data.pipeCondition !== "Good") {
      var pipesSheet = ss.getSheetByName(SHEET_PIPES);
      if (pipesSheet) {
        var pipesData = pipesSheet.getDataRange().getValues();
        for (var i = 1; i < pipesData.length; i++) {
          if (pipesData[i][0] === data.pipeId) {
            pipesSheet.getRange(i + 1, 5).setValue(data.pipeCondition);
            break;
          }
        }
      }
    }
    
    return {
      success: true,
      message: "Monitoring visit recorded successfully for Pipe " + data.pipeId
    };
    
  } catch (err) {
    return { success: false, message: "Server Error: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to format date object/string nicely YYYY-MM-DD
 */
function formatDate(dateObj) {
  if (!dateObj) return "N/A";
  if (dateObj instanceof Date) {
    return Utilities.formatDate(dateObj, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(dateObj).substring(0, 10);
}
`;

export const SETUP_GS = `/**
 * Google Sheet Database Setup Script (Setup.gs)
 * 
 * Run 'setupDatabaseSheets()' once from the Apps Script editor to create
 * all required sheet tabs, header rows, column widths, and initial AWD Pipe IDs.
 */

function setupDatabaseSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Create AWD_Pipes Sheet
  var pipesSheet = ss.getSheetByName("AWD_Pipes");
  if (!pipesSheet) {
    pipesSheet = ss.insertSheet("AWD_Pipes");
  }
  pipesSheet.clear();
  
  var pipeHeaders = [
    "Pipe_ID", "Batch_No", "QR_URL", "QR_Code", "Status", 
    "Installation_Date", "Farmer_Name", "Village"
  ];
  pipesSheet.getRange(1, 1, 1, pipeHeaders.length).setValues([pipeHeaders]);
  pipesSheet.getRange(1, 1, 1, pipeHeaders.length).setFontWeight("bold").setBackground("#10b981").setFontColor("#ffffff");
  pipesSheet.setFrozenRows(1);
  
  // 2. Create Installations Sheet
  var instSheet = ss.getSheetByName("Installations");
  if (!instSheet) {
    instSheet = ss.insertSheet("Installations");
  }
  instSheet.clear();
  
  var instHeaders = [
    "Timestamp", "Pipe_ID", "Farmer_Name", "Mobile", "Farmer_ID",
    "Village", "Mandal", "District", "Survey_No", "Plot_Size",
    "Plot_Size_Unit", "Crop", "Variety", "Establishment_Method",
    "Sowing_Transplantation_Date", "Nursery_Sowing_Date", "Irrigation_Source",
    "Installation_Date", "Latitude", "Longitude", "GPS_Accuracy",
    "Location_Link", "Installed_By", "Remarks"
  ];
  instSheet.getRange(1, 1, 1, instHeaders.length).setValues([instHeaders]);
  instSheet.getRange(1, 1, 1, instHeaders.length).setFontWeight("bold").setBackground("#059669").setFontColor("#ffffff");
  instSheet.setFrozenRows(1);
  
  // 3. Create Monitoring Sheet
  var monSheet = ss.getSheetByName("Monitoring");
  if (!monSheet) {
    monSheet = ss.insertSheet("Monitoring");
  }
  monSheet.clear();
  
  var monHeaders = [
    "Timestamp", "Pipe_ID", "Visit_Date", "Water_Level", "Crop_Stage",
    "AWD_Followed", "Pipe_Condition", "Visited_By", "Latitude", "Longitude", "Remarks"
  ];
  monSheet.getRange(1, 1, 1, monHeaders.length).setValues([monHeaders]);
  monSheet.getRange(1, 1, 1, monHeaders.length).setFontWeight("bold").setBackground("#047857").setFontColor("#ffffff");
  monSheet.setFrozenRows(1);

  // 4. Seed initial 100 Pipe IDs (AWD-0001 to AWD-0100)
  generatePipeBatch("BATCH-2026-01", 1, 100);
  
  SpreadsheetApp.getUi().alert("Database Setup Complete! Sheets 'AWD_Pipes', 'Installations', and 'Monitoring' configured with 100 AWD Pipe IDs.");
}

/**
 * Utility to generate a batch of unique AWD Pipe IDs
 */
function generatePipeBatch(batchNo, startNum, endNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pipesSheet = ss.getSheetByName("AWD_Pipes");
  if (!pipesSheet) return;
  
  var batchNoStr = batchNo || "BATCH-" + new Date().getFullYear();
  var rows = [];
  
  for (var i = startNum; i <= endNum; i++) {
    var numStr = ("0000" + i).slice(-4);
    var pipeId = "AWD-" + numStr;
    // Pipe_ID, Batch_No, QR_URL, QR_Code, Status, Installation_Date, Farmer_Name, Village
    rows.push([pipeId, batchNoStr, "", "", "Available", "", "", ""]);
  }
  
  var lastRow = Math.max(pipesSheet.getLastRow(), 1);
  pipesSheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);
}
`;

export const GENERATOR_GS = `/**
 * Bulk QR URL & Printable Sheet Generator (Generator.gs)
 * 
 * Generates Web App target URLs and QR formulas for all Pipe IDs in AWD_Pipes.
 */

/**
 * Updates the QR_URL and QR_Code columns in AWD_Pipes using deployed Web App URL
 */
function populateQRUrls() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    "Enter Web App Deployment URL",
    "Paste your published Apps Script Web App URL (e.g., https://script.google.com/macros/s/AKfycb.../exec):",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var webAppUrl = response.getResponseText().trim();
  
  if (!webAppUrl || webAppUrl.indexOf("script.google.com") === -1) {
    ui.alert("Invalid Web App URL. Please deploy as Web App first and copy the execution URL.");
    return;
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("AWD_Pipes");
  var lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    ui.alert("No pipe records found in AWD_Pipes.");
    return;
  }
  
  var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues(); // Read Column A Pipe_IDs
  var qrUrls = [];
  var qrFormulas = [];
  
  for (var i = 0; i < data.length; i++) {
    var pipeId = data[i][0];
    var targetUrl = webAppUrl + "?id=" + encodeURIComponent(pipeId);
    qrUrls.push([targetUrl]);
    
    // Google Sheets IMAGE formula using QuickChart API
    var qrFormula = '=IMAGE("https://quickchart.io/qr?size=200&text=' + encodeURIComponent(targetUrl) + '")';
    qrFormulas.push([qrFormula]);
  }
  
  // Set QR_URL in Col C and QR_Code formula in Col D
  sheet.getRange(2, 3, qrUrls.length, 1).setValues(qrUrls);
  sheet.getRange(2, 4, qrFormulas.length, 1).setFormulas(qrFormulas);
  
  // Adjust row height to display QR codes clearly
  sheet.setRowHeights(2, lastRow - 1, 80);
  sheet.setColumnWidth(4, 100);
  
  ui.alert("Successfully updated QR URLs and image formulas for " + data.length + " AWD pipes!");
}
`;

export const INDEX_HTML_GS = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>AWD Pipe Registration & Monitoring</title>
  <!-- Tailwind CSS via CDN for Apps Script HTML Service -->
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; }
    .touch-btn { min-height: 48px; }
  </style>
</head>
<body class="bg-emerald-900/5 min-h-screen text-slate-800 pb-12">

  <!-- Header Banner -->
  <header class="bg-gradient-to-r from-emerald-800 to-teal-800 text-white shadow-md">
    <div class="max-w-md mx-auto px-4 py-5 text-center">
      <div class="inline-flex items-center gap-2 bg-emerald-700/60 text-emerald-100 text-xs font-semibold px-3 py-1 rounded-full mb-2 border border-emerald-500/30">
        🌱 Paddy Water Management System
      </div>
      <h1 class="text-xl font-bold tracking-tight">AWD Pipe Registration & Monitoring</h1>
      <p class="text-xs text-emerald-200 mt-1">Alternate Wetting and Drying Technology</p>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-md mx-auto px-4 mt-4">
    
    <!-- Loading Screen -->
    <div id="loadingState" class="bg-white rounded-2xl p-8 text-center shadow-lg border border-slate-200/60 my-6">
      <div class="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent mb-3"></div>
      <p class="text-slate-600 font-medium text-sm">Validating AWD Pipe ID...</p>
    </div>

    <!-- Error Screen -->
    <div id="errorState" class="hidden bg-red-50 rounded-2xl p-6 text-center border border-red-200 my-6">
      <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-xl">✕</div>
      <h3 id="errorTitle" class="text-red-800 font-bold text-lg mb-1">Invalid Pipe ID</h3>
      <p id="errorMessage" class="text-red-600 text-sm mb-4">The scanned Pipe ID was not found in our records.</p>
    </div>

    <!-- REGISTERED PIPE VIEW (AWD Pipe Information) -->
    <div id="registeredState" class="hidden space-y-4">
      <div class="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
        <div class="flex items-center justify-between border-b pb-3 mb-3">
          <div>
            <span class="text-xs uppercase tracking-wider text-slate-400 font-bold">Pipe ID</span>
            <h2 id="regPipeId" class="text-xl font-black text-emerald-800">AWD-0000</h2>
          </div>
          <span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.0 rounded-full border border-emerald-300">
            ✓ Installed
          </span>
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Farmer Name</span><span id="regFarmerName" class="font-semibold text-slate-800">--</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Mobile</span><span id="regMobile" class="font-medium text-slate-600">******</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Village / Mandal</span><span id="regLocation" class="font-semibold text-slate-800">--</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Plot Size</span><span id="regPlotSize" class="font-semibold text-slate-800">--</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Method</span><span id="regMethod" class="font-semibold text-slate-800">--</span></div>
          <div class="flex justify-between py-1 border-b border-slate-100"><span class="text-slate-500">Sowing/Transplantation</span><span id="regSowingDate" class="font-medium text-slate-700">--</span></div>
          <div class="flex justify-between py-1"><span class="text-slate-500">Installation Date</span><span id="regInstDate" class="font-medium text-slate-700">--</span></div>
        </div>

        <div class="mt-4 pt-3 border-t grid grid-cols-2 gap-2">
          <a id="regMapBtn" href="#" target="_blank" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
            📍 View Location
          </a>
          <button onclick="showMonitoringModal()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow">
            ➕ Add Visit
          </button>
        </div>
      </div>
    </div>

    <!-- UNREGISTERED PIPE FORM (Farmer Registration) -->
    <div id="unregisteredState" class="hidden">
      <form id="regForm" onsubmit="submitRegistration(event)" class="bg-white rounded-2xl shadow-lg border border-slate-200/80 p-5 space-y-4">
        
        <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center">
          <div>
            <span class="text-xs text-emerald-700 font-semibold block">AWD Pipe ID</span>
            <span id="formPipeIdDisplay" class="text-lg font-black text-emerald-900">AWD-0000</span>
          </div>
          <span class="bg-emerald-200/80 text-emerald-900 text-xs px-2.5 py-1 rounded-md font-bold">Unused Pipe</span>
        </div>

        <!-- Section: Farmer Details -->
        <div class="space-y-3 pt-2">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-1">
            <span class="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Farmer Details
          </h3>
          
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Farmer Name *</label>
            <input type="text" id="farmerName" required placeholder="Full Name of Farmer" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
            <input type="tel" id="mobile" required placeholder="10-digit Mobile Number" maxlength="10" pattern="[6-9][0-9]{9}" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Village *</label>
              <input type="text" id="village" required placeholder="Village" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Mandal *</label>
              <input type="text" id="mandal" required placeholder="Mandal" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">District *</label>
              <input type="text" id="district" required placeholder="District" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Farmer ID (Optional)</label>
              <input type="text" id="farmerId" placeholder="State/Aadhaar ID" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
          </div>
        </div>

        <!-- Section: Plot Details -->
        <div class="space-y-3 pt-2">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-1">
            <span class="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Plot & Crop Details
          </h3>

          <div class="grid grid-cols-3 gap-2">
            <div class="col-span-1">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Survey No.</label>
              <input type="text" id="surveyNo" placeholder="Plot No." class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
            <div class="col-span-1">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Plot Size *</label>
              <input type="number" step="0.1" min="0.1" id="plotSize" required placeholder="e.g. 2.5" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
            <div class="col-span-1">
              <label class="block text-xs font-semibold text-slate-700 mb-1">Unit *</label>
              <select id="plotSizeUnit" required class="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="Acres">Acres</option>
                <option value="Hectares">Hectares</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Crop</label>
              <input type="text" id="crop" value="Paddy" class="w-full border rounded-xl p-2.5 text-sm bg-slate-50 text-slate-600 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Paddy Variety</label>
              <input type="text" id="variety" placeholder="e.g. Telangana Sona" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Establishment Method *</label>
            <select id="establishmentMethod" required onchange="handleMethodChange(this.value)" class="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium">
              <option value="Dry DSR">Dry DSR (Dry Direct Seeded Rice)</option>
              <option value="Wet DSR">Wet DSR (Wet Direct Seeded Rice)</option>
              <option value="TPR">TPR (Transplanted Rice)</option>
            </select>
          </div>

          <div>
            <label id="sowingDateLabel" class="block text-xs font-semibold text-slate-700 mb-1">Sowing Date *</label>
            <input type="date" id="sowingDate" required class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div id="nurseryDateGroup" class="hidden">
            <label class="block text-xs font-semibold text-slate-700 mb-1">Nursery Sowing Date (Optional for TPR)</label>
            <input type="date" id="nurserySowingDate" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Irrigation Source *</label>
            <select id="irrigationSource" required onchange="handleIrrigationChange(this.value)" class="w-full border rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="Borewell">Borewell</option>
              <option value="Canal">Canal</option>
              <option value="Tank">Tank</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div id="irrigationOtherGroup" class="hidden">
            <label class="block text-xs font-semibold text-slate-700 mb-1">Specify Irrigation Source *</label>
            <input type="text" id="irrigationSourceOther" placeholder="Describe irrigation source" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
          </div>
        </div>

        <!-- Section: Installation Details & GPS -->
        <div class="space-y-3 pt-2">
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-1">
            <span class="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Installation & GPS Location
          </h3>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Installation Date *</label>
              <input type="date" id="installationDate" required class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Installed By *</label>
              <input type="text" id="installedBy" required placeholder="Staff Name / Designation" class="w-full border rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
            </div>
          </div>

          <!-- GPS Capture Box -->
          <div class="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-2">
            <button type="button" onclick="captureGPS()" class="touch-btn w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow">
              📍 Capture Current GPS Location
            </button>
            <div id="gpsDisplay" class="text-xs text-slate-500 text-center py-1">
              GPS location required before submitting.
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
            <textarea id="remarks" rows="2" placeholder="Field observations or pipe placement notes..." class="w-full border rounded-xl p-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"></textarea>
          </div>
        </div>

        <!-- Submit Button -->
        <button type="submit" id="submitBtn" class="touch-btn w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-base py-3 transition shadow-md">
          Submit AWD Pipe Registration
        </button>
      </form>
    </div>

    <!-- SUCCESS SCREEN -->
    <div id="successState" class="hidden bg-white rounded-2xl p-6 text-center shadow-xl border border-emerald-200 my-4 space-y-4">
      <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black">✓</div>
      <h2 class="text-xl font-black text-slate-800">AWD Pipe Registered Successfully!</h2>
      
      <div class="bg-slate-50 rounded-xl p-4 text-left space-y-2 text-xs border border-slate-200">
        <div class="flex justify-between"><span class="text-slate-500">Pipe ID</span><span id="succPipeId" class="font-bold text-emerald-800">--</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Farmer Name</span><span id="succFarmerName" class="font-bold text-slate-800">--</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Village</span><span id="succVillage" class="font-bold text-slate-800">--</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Plot Size</span><span id="succPlotSize" class="font-bold text-slate-800">--</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Method</span><span id="succMethod" class="font-bold text-slate-800">--</span></div>
        <div class="flex justify-between"><span class="text-slate-500">Installation Date</span><span id="succInstDate" class="font-bold text-slate-800">--</span></div>
      </div>

      <button onclick="window.location.reload()" class="touch-btn w-full bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition">
        View AWD Pipe Record
      </button>
    </div>

    <!-- MONITORING MODAL -->
    <div id="monitoringModal" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-bold text-slate-800 text-base">➕ Add Monitoring Visit</h3>
          <button onclick="hideMonitoringModal()" class="text-slate-400 text-xl font-bold px-2">✕</button>
        </div>
        
        <form onsubmit="submitMonitoring(event)" class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Visit Date *</label>
            <input type="date" id="monVisitDate" required class="w-full border rounded-xl p-2 text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Water Level in Pipe *</label>
            <input type="text" id="monWaterLevel" required placeholder="e.g., -5 cm below surface" class="w-full border rounded-xl p-2 text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Crop Stage *</label>
            <select id="monCropStage" required class="w-full border rounded-xl p-2 text-sm">
              <option value="Tillering">Tillering</option>
              <option value="Panicle Initiation">Panicle Initiation</option>
              <option value="Flowering">Flowering</option>
              <option value="Grain Filling">Grain Filling</option>
              <option value="Harvesting">Harvesting</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">AWD Followed? *</label>
            <select id="monAwdFollowed" required class="w-full border rounded-xl p-2 text-sm">
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Partially">Partially</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Pipe Condition *</label>
            <select id="monPipeCondition" required class="w-full border rounded-xl p-2 text-sm">
              <option value="Good">Good</option>
              <option value="Damaged">Damaged</option>
              <option value="Missing">Missing</option>
              <option value="Replaced">Replaced</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Visited By *</label>
            <input type="text" id="monVisitedBy" required placeholder="Field Officer Name" class="w-full border rounded-xl p-2 text-sm">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
            <textarea id="monRemarks" rows="2" class="w-full border rounded-xl p-2 text-sm"></textarea>
          </div>
          <button type="submit" id="monSubmitBtn" class="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm transition">
            Save Monitoring Record
          </button>
        </form>
      </div>
    </div>

  </main>

  <script>
    var currentPipeId = "<?= initialPipeId ?>";
    var capturedLat = null;
    var capturedLng = null;
    var capturedAcc = null;

    window.onload = function() {
      // Default dates
      var today = new Date().toISOString().substring(0, 10);
      document.getElementById("installationDate").value = today;
      document.getElementById("monVisitDate").value = today;

      if (!currentPipeId) {
        showError("Missing Pipe ID", "Please scan a valid AWD Pipe QR code containing '?id=AWD-XXXX'.");
        return;
      }

      // Call Google Apps Script server function getPipeDetails
      google.script.run
        .withSuccessHandler(onPipeDetailsLoaded)
        .withFailureHandler(function(err) {
          showError("Server Connection Error", err.toString());
        })
        .getPipeDetails(currentPipeId);
    };

    function onPipeDetailsLoaded(res) {
      document.getElementById("loadingState").classList.add("hidden");

      if (!res.success) {
        showError("Invalid Pipe", res.message);
        return;
      }

      if (res.isRegistered) {
        // Display Pipe Info Page
        var inst = res.installation;
        document.getElementById("regPipeId").innerText = inst.pipeId;
        document.getElementById("regFarmerName").innerText = inst.farmerName;
        document.getElementById("regMobile").innerText = inst.maskedMobile;
        document.getElementById("regLocation").innerText = inst.village + ", " + inst.mandal;
        document.getElementById("regPlotSize").innerText = inst.plotSize;
        document.getElementById("regMethod").innerText = inst.establishmentMethod;
        document.getElementById("regSowingDate").innerText = inst.sowingDate;
        document.getElementById("regInstDate").innerText = inst.installationDate;
        document.getElementById("regMapBtn").href = inst.locationLink;
        document.getElementById("registeredState").classList.remove("hidden");
      } else {
        // Display Registration Form
        document.getElementById("formPipeIdDisplay").innerText = res.pipeId;
        document.getElementById("unregisteredState").classList.remove("hidden");
      }
    }

    function handleMethodChange(val) {
      var lbl = document.getElementById("sowingDateLabel");
      var nurseryGroup = document.getElementById("nurseryDateGroup");
      if (val === "TPR") {
        lbl.innerText = "Transplantation Date *";
        nurseryGroup.classList.remove("hidden");
      } else {
        lbl.innerText = "Sowing Date *";
        nurseryGroup.classList.add("hidden");
      }
    }

    function handleIrrigationChange(val) {
      var group = document.getElementById("irrigationOtherGroup");
      if (val === "Other") group.classList.remove("hidden");
      else group.classList.add("hidden");
    }

    function captureGPS() {
      var display = document.getElementById("gpsDisplay");
      display.innerHTML = "<span class='text-amber-600 font-semibold'>⌛ Locating GPS satellite signal...</span>";

      if (!navigator.geolocation) {
        display.innerHTML = "<span class='text-red-600'>Geolocation is not supported by your browser.</span>";
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function(pos) {
          capturedLat = pos.coords.latitude.toFixed(6);
          capturedLng = pos.coords.longitude.toFixed(6);
          capturedAcc = Math.round(pos.coords.accuracy);

          display.innerHTML = "<div class='bg-emerald-100 text-emerald-900 border border-emerald-300 p-2 rounded-lg font-mono text-xs'>" +
            "✓ Location Captured<br>Lat: " + capturedLat + " | Long: " + capturedLng + "<br>Accuracy: " + capturedAcc + " meters" +
            "</div>";
        },
        function(err) {
          display.innerHTML = "<span class='text-red-600 font-semibold'>Location permission required. Enable GPS access in browser settings.</span>";
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    }

    function submitRegistration(e) {
      e.preventDefault();

      if (!capturedLat || !capturedLng) {
        alert("Location permission is required to register this AWD pipe. Please tap 'Capture Current GPS Location' and allow location access.");
        return;
      }

      var submitBtn = document.getElementById("submitBtn");
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting Registration...";

      var data = {
        pipeId: currentPipeId,
        farmerName: document.getElementById("farmerName").value,
        mobile: document.getElementById("mobile").value,
        village: document.getElementById("village").value,
        mandal: document.getElementById("mandal").value,
        district: document.getElementById("district").value,
        farmerId: document.getElementById("farmerId").value,
        surveyNo: document.getElementById("surveyNo").value,
        plotSize: document.getElementById("plotSize").value,
        plotSizeUnit: document.getElementById("plotSizeUnit").value,
        crop: document.getElementById("crop").value,
        variety: document.getElementById("variety").value,
        establishmentMethod: document.getElementById("establishmentMethod").value,
        sowingDate: document.getElementById("sowingDate").value,
        nurserySowingDate: document.getElementById("nurserySowingDate").value,
        irrigationSource: document.getElementById("irrigationSource").value,
        irrigationSourceOther: document.getElementById("irrigationSourceOther").value,
        installationDate: document.getElementById("installationDate").value,
        installedBy: document.getElementById("installedBy").value,
        remarks: document.getElementById("remarks").value,
        latitude: capturedLat,
        longitude: capturedLng,
        gpsAccuracy: capturedAcc
      };

      google.script.run
        .withSuccessHandler(function(res) {
          if (res.success) {
            document.getElementById("unregisteredState").classList.add("hidden");
            document.getElementById("succPipeId").innerText = res.record.pipeId;
            document.getElementById("succFarmerName").innerText = res.record.farmerName;
            document.getElementById("succVillage").innerText = res.record.village;
            document.getElementById("succPlotSize").innerText = res.record.plotSize;
            document.getElementById("succMethod").innerText = res.record.establishmentMethod;
            document.getElementById("succInstDate").innerText = res.record.installationDate;
            document.getElementById("successState").classList.remove("hidden");
          } else {
            alert("Error: " + res.message);
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit AWD Pipe Registration";
          }
        })
        .withFailureHandler(function(err) {
          alert("Submission Failed: " + err.toString());
          submitBtn.disabled = false;
          submitBtn.innerText = "Submit AWD Pipe Registration";
        })
        .registerInstallation(data);
    }

    function showMonitoringModal() {
      document.getElementById("monitoringModal").classList.remove("hidden");
    }

    function hideMonitoringModal() {
      document.getElementById("monitoringModal").classList.add("hidden");
    }

    function submitMonitoring(e) {
      e.preventDefault();
      var btn = document.getElementById("monSubmitBtn");
      btn.disabled = true;
      btn.innerText = "Saving Visit...";

      var data = {
        pipeId: currentPipeId,
        visitDate: document.getElementById("monVisitDate").value,
        waterLevel: document.getElementById("monWaterLevel").value,
        cropStage: document.getElementById("monCropStage").value,
        awdFollowed: document.getElementById("monAwdFollowed").value,
        pipeCondition: document.getElementById("monPipeCondition").value,
        visitedBy: document.getElementById("monVisitedBy").value,
        remarks: document.getElementById("monRemarks").value,
        latitude: capturedLat || "",
        longitude: capturedLng || ""
      };

      google.script.run
        .withSuccessHandler(function(res) {
          if (res.success) {
            alert(res.message);
            hideMonitoringModal();
            window.location.reload();
          } else {
            alert("Error: " + res.message);
            btn.disabled = false;
            btn.innerText = "Save Monitoring Record";
          }
        })
        .addMonitoringVisit(data);
    }

    function showError(title, msg) {
      document.getElementById("loadingState").classList.add("hidden");
      document.getElementById("errorTitle").innerText = title;
      document.getElementById("errorMessage").innerText = msg;
      document.getElementById("errorState").classList.remove("hidden");
    }
  </script>
</body>
</html>
`;

export const SETUP_GUIDE_MARKDOWN = `# Complete Setup & Deployment Guide for Google Apps Script + Google Sheets

Follow these step-by-step instructions to create, authorize, deploy, and operate your **AWD Pipe QR-Based Farmer Registration and Monitoring System** on Google Cloud & Google Workspace.

---

### Step 1: Create a New Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com) and click **Blank Spreadsheet**.
2. Rename the spreadsheet to **\`AWD Pipe Master Database\`**.

---

### Step 2: Open Google Apps Script Editor
1. In the top menu of your Google Sheet, click **Extensions** > **Apps Script**.
2. A new tab will open with the Apps Script editor. Rename the project to **\`AWD_Pipe_System\`**.

---

### Step 3: Create Project Code Files
You need to create 4 code files in the Apps Script left panel:

1. **\`Code.gs\`** (already created by default, replace content with code from the **Code.gs** tab above).
2. **\`Setup.gs\`** (Click **+** > **Script**, name it \`Setup.gs\`, paste code from the **Setup.gs** tab).
3. **\`Generator.gs\`** (Click **+** > **Script**, name it \`Generator.gs\`, paste code from the **Generator.gs** tab).
4. **\`Index.html\`** (Click **+** > **HTML**, name it \`Index\` - Apps Script automatically appends \`.html\`, paste code from the **Index.html** tab).

---

### Step 4: Run Initial Database Setup
1. In the Apps Script top toolbar, select the function **\`setupDatabaseSheets\`** from the function dropdown.
2. Click **Run**.

---

### Step 5: Grant Authorization Permissions
1. When prompted with **Authorization Required**, click **Review Permissions**.
2. Select your Google Account.
3. Click **Advanced** > **Go to AWD_Pipe_System (unsafe)**.
4. Click **Allow** to grant permission to edit Google Sheets.
5. The script will initialize 3 sheet tabs: \`AWD_Pipes\`, \`Installations\`, and \`Monitoring\` with headers and 100 sample Pipe IDs (\`AWD-0001\` to \`AWD-0100\`).

---

### Step 6: Deploy as a Web Application
1. In the top right of the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon (**Select type**) next to "Select type" and choose **Web app**.
3. Configure settings exactly as follows:
   - **Description**: \`AWD Pipe QR Web App v1\`
   - **Execute as**: **\`Me (your.email@gmail.com)\`** *(Ensures script accesses Google Sheets under your permission)*
   - **Who has access**: **\`Anyone\`** *(Crucial so field agents can access QR registration without needing Google account logins)*
4. Click **Deploy**.

---

### Step 7: Obtain Web App Deployment URL
1. Copy the generated **Web App URL** (format: \`https://script.google.com/macros/s/AKfycb.../exec\`).
2. Keep this URL safe; this will be the base endpoint for all AWD QR codes.

---

### Step 8: Generate AWD Pipe QR URLs in Bulk
1. Return to the Apps Script editor.
2. Select the function **\`populateQRUrls\`** from the top dropdown and click **Run**.
3. A popup prompt will appear in Google Sheets. Paste your copied **Web App URL** and click **OK**.
4. The script will automatically populate Column C (\`QR_URL\`) and Column D (\`QR_Code\` image formula) for all 100 AWD pipes.

---

### Step 9: Print & Create AWD QR Labels
1. Copy the target Pipe IDs or export QR images to printable sheets.
2. Ensure printed stickers include both the **QR Code image** AND human-readable text **\`AWD-0001\`** printed below it.

---

### Step 10: Test Pipe Scanning on Smartphone
1. Open camera on Android or iPhone and scan the QR code for \`AWD-0001\` (or paste \`WEB_APP_URL?id=AWD-0001\` into your browser).
2. The web page should automatically load with **AWD Pipe Registration** and \`Pipe ID: AWD-0001\` pre-filled.

---

### Step 11: Test GPS Geolocation Capture
1. Tap **📍 Capture Current GPS Location**.
2. Allow browser location access when prompted.
3. Verify latitude, longitude, and accuracy meters display successfully.

---

### Step 12: Test Registration Submission
1. Fill in farmer details (e.g. Ramesh Patel, Mobile: 9848012345, Village: Peddapalli, Method: Dry DSR).
2. Tap **Submit AWD Pipe Registration**.
3. Confirm the success message appears with summary details.

---

### Step 13: Verify Database Updates in Google Sheets
1. Switch to your Google Sheet.
2. Check tab **\`Installations\`**: A new row should be added with timestamp, farmer details, coordinates, and Google Maps link.
3. Check tab **\`AWD_Pipes\`**: \`AWD-0001\` status should change from \`Available\` to \`Installed\`.

---

### Step 14: Test Duplicate Prevention
1. Re-scan or re-open \`WEB_APP_URL?id=AWD-0001\`.
2. System will detect existing registration and display **AWD Pipe Information** instead of registration form.
3. Verify full phone number and Farmer ID are masked for privacy.

---

### Step 15: Test Monitoring Visits
1. On the Pipe Information screen, tap **➕ Add Visit**.
2. Enter Water Level (-5 cm), Crop Stage (Tillering), AWD Followed (Yes), and tap **Save Monitoring Record**.
3. Verify new row appears in tab **\`Monitoring\`**.

---

### Step 16: Expansion for 1,000 to 5,000 Pipes
To generate additional pipe batches later, run:
\`generatePipeBatch("BATCH-2026-02", 101, 1000);\`
in \`Setup.gs\`, then re-run \`populateQRUrls()\`.
`;
