/**
 * UIU Made Easy - Advisor Logic Module
 * Browser-based course planning advisor with OCR support
 * Compatible with GitHub Pages (client-side only)
 */

const UIUAdvisor = (function () {
  // ============================================
  // CONSTANTS
  // ============================================
  const TOTAL_REQUIRED_CREDITS = 138;
  const SLOT_ORDER = ["T1", "T2", "T3"];

  // ============================================
  // STATE - Assumed to be loaded externally
  // ============================================
  let coreCourses = [];
  let majorCoursesByMajor = {};
  let gedCourses = [];

  // User state
  let state = {
    completed_courses: [],
    completed_credits: 0,
    current_semester: 1,
    target_graduation_semester: 12,
    max_credits_per_semester: 15,
    cgpa: 3.0,
    selected_major: "",
    mode: "AUTO",
    user_selected_courses: [],
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize the advisor with course data
   * @param {Object} data - { coreCourses, majorCoursesByMajor, gedCourses }
   */
  function init(data) {
    if (data.coreCourses) coreCourses = data.coreCourses;
    if (data.majorCoursesByMajor)
      majorCoursesByMajor = data.majorCoursesByMajor;
    if (data.gedCourses) gedCourses = data.gedCourses;
  }

  /**
   * Update user state
   * @param {Object} newState - Partial state to merge
   */
  function setState(newState) {
    state = { ...state, ...newState };
  }

  /**
   * Get all known courses combined
   * @returns {Array} - All courses from all sources
   */
  function getAllKnownCourses() {
    const allMajorCourses = Object.values(majorCoursesByMajor).flat();
    return [...coreCourses, ...allMajorCourses, ...gedCourses];
  }

  // ============================================
  // PDF PARSING (Course Plan PDF)
  // ============================================

  /**
   * Extract course information from a PDF file using PDF.js
   * @param {File|ArrayBuffer|string} pdfSource - PDF file, ArrayBuffer, or URL
   * @returns {Promise<Object>} - { extractedCourses, rawText, newCourses }
   */
  async function extractCoursesFromPDF(pdfSource) {
    if (typeof pdfjsLib === "undefined") {
      throw new Error(
        "PDF.js is not loaded. Please include it: https://mozilla.github.io/pdf.js/",
      );
    }

    const result = {
      extractedCourses: [],
      rawText: "",
      newCourses: [],
      matchedCourses: [],
    };

    try {
      // Load PDF
      let loadingTask;
      if (pdfSource instanceof File) {
        const arrayBuffer = await pdfSource.arrayBuffer();
        loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      } else if (pdfSource instanceof ArrayBuffer) {
        loadingTask = pdfjsLib.getDocument({ data: pdfSource });
      } else {
        loadingTask = pdfjsLib.getDocument(pdfSource);
      }

      const pdf = await loadingTask.promise;
      let fullText = "";

      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        fullText += pageText + "\n";
      }

      result.rawText = fullText;

      // Course code patterns
      const courseCodePattern = /([A-Z]{2,4})\s*(\d{4}[A-Z]?)/gi;
      const matches = fullText.matchAll(courseCodePattern);

      const allKnownCourses = getAllKnownCourses();
      const knownCodesMap = new Map();
      allKnownCourses.forEach((c) =>
        knownCodesMap.set(c.course_code.toUpperCase(), c),
      );

      const seenCodes = new Set();

      for (const match of matches) {
        const prefix = match[1].toUpperCase();
        const number = match[2].toUpperCase();
        const normalizedCode = `${prefix} ${number}`;

        if (seenCodes.has(normalizedCode)) continue;
        seenCodes.add(normalizedCode);

        const knownCourse = knownCodesMap.get(normalizedCode);

        if (knownCourse) {
          result.matchedCourses.push({
            course_code: normalizedCode,
            course_name: knownCourse.course_name,
            credit: knownCourse.credit,
            source: "JSON",
          });
        } else {
          // Course found in PDF but not in JSON - attempt to extract details
          const courseInfo = extractCourseDetailsFromText(
            fullText,
            normalizedCode,
          );
          result.newCourses.push({
            course_code: normalizedCode,
            course_name: courseInfo.name || "Unknown",
            credit: courseInfo.credit || 3,
            source: "PDF",
          });
        }

        result.extractedCourses.push(normalizedCode);
      }
    } catch (error) {
      console.error("PDF extraction failed:", error);
      throw error;
    }

    return result;
  }

  /**
   * Helper: Extract course name and credit from raw text near a course code
   * @param {string} text - Full PDF text
   * @param {string} courseCode - Course code to search for
   * @returns {Object} - { name, credit }
   */
  function extractCourseDetailsFromText(text, courseCode) {
    const result = { name: null, credit: null };

    // Pattern: "CSE 1234 Course Name Here 3" or "CSE 1234 - Course Name (3 cr)"
    const escapedCode = courseCode.replace(/\s+/g, "\\s*");
    const detailPattern = new RegExp(
      `${escapedCode}[\\s\\-:]+([A-Za-z][A-Za-z\\s&,'-]{5,50})(?:[\\s(]*(\\d)(?:\\s*(?:cr|credits?))?)?`,
      "i",
    );

    const match = text.match(detailPattern);
    if (match) {
      result.name = match[1] ? match[1].trim() : null;
      result.credit = match[2] ? parseInt(match[2], 10) : null;
    }

    return result;
  }

  /**
   * Parse a course plan PDF and merge with existing JSON data
   * @param {File} pdfFile - PDF file
   * @returns {Promise<Object>} - { allCourses, fromJSON, fromPDF }
   */
  async function parseCoursePlanPDF(pdfFile) {
    const pdfData = await extractCoursesFromPDF(pdfFile);

    return {
      allCourses: [...pdfData.matchedCourses, ...pdfData.newCourses],
      fromJSON: pdfData.matchedCourses,
      fromPDF: pdfData.newCourses,
      extractedCodes: pdfData.extractedCourses,
      rawText: pdfData.rawText,
    };
  }

  // ============================================
  // 1. OCR-BASED COMPLETED COURSE DETECTION
  // ============================================

  /**
   * Extract completed courses from a screenshot using Tesseract.js OCR
   * @param {File|Blob|string} imageFile - Image file, blob, or URL
   * @returns {Promise<Object>} - { detectedCourses, unmatchedText }
   */
  async function extractCompletedCoursesFromScreenshot(imageFile) {
    if (typeof Tesseract === "undefined") {
      throw new Error(
        "Tesseract.js is not loaded. Please include it in your page.",
      );
    }

    const result = {
      detectedCourses: [],
      unmatchedText: [],
    };

    try {
      // Run OCR
      const { data } = await Tesseract.recognize(imageFile, "eng", {
        logger: (m) => console.log(m),
      });

      const extractedText = data.text;
      const lines = extractedText.split("\n");

      // Course code patterns: "CSE 2215", "CSE2215", "ENG 1011", etc.
      const courseCodePattern = /([A-Z]{2,4})\s*(\d{4}[A-Z]?)/gi;

      const allKnownCourses = getAllKnownCourses();
      const knownCodesSet = new Set(
        allKnownCourses.map((c) => c.course_code.toUpperCase()),
      );

      for (const line of lines) {
        const matches = line.matchAll(courseCodePattern);

        for (const match of matches) {
          // Normalize format to "XXX 1234"
          const prefix = match[1].toUpperCase();
          const number = match[2].toUpperCase();
          const normalizedCode = `${prefix} ${number}`;

          // Calculate confidence based on exact match
          const isKnown = knownCodesSet.has(normalizedCode);
          const confidence = isKnown ? 0.95 : 0.5;

          if (isKnown) {
            result.detectedCourses.push({
              course_code: normalizedCode,
              confidence: confidence,
            });
          } else {
            result.unmatchedText.push(normalizedCode);
          }
        }
      }

      // Remove duplicates from detected courses
      const seenCodes = new Set();
      result.detectedCourses = result.detectedCourses.filter((c) => {
        if (seenCodes.has(c.course_code)) return false;
        seenCodes.add(c.course_code);
        return true;
      });

      // Remove duplicates from unmatched
      result.unmatchedText = [...new Set(result.unmatchedText)];
    } catch (error) {
      console.error("OCR extraction failed:", error);
      throw error;
    }

    return result;
  }

  /**
   * Merge OCR-detected courses with manually entered courses
   * @param {Array} ocrCourses - Array of { course_code, confidence }
   * @param {Array} manualCourses - Array of course codes (strings)
   * @returns {Array} - Merged unique course codes
   */
  function mergeCompletedCourses(ocrCourses, manualCourses) {
    const merged = new Set(manualCourses.map((c) => c.toUpperCase()));
    for (const c of ocrCourses) {
      merged.add(c.course_code.toUpperCase());
    }
    return Array.from(merged);
  }

  // ============================================
  // 2. REMAINING CREDIT & GRADUATION STATUS
  // ============================================

  /**
   * Calculate graduation status based on remaining credits and semesters
   * @returns {Object} - { remainingCredits, remainingSemesters, avgCreditsNeeded, graduationStatus }
   */
  function calculateGraduationStatus() {
    const remainingCredits = TOTAL_REQUIRED_CREDITS - state.completed_credits;
    const remainingSemesters =
      state.target_graduation_semester - state.current_semester;

    if (remainingSemesters <= 0) {
      return {
        remainingCredits,
        remainingSemesters: 0,
        avgCreditsNeeded: remainingCredits,
        graduationStatus: remainingCredits <= 0 ? "GRADUATED" : "OVERDUE",
      };
    }

    const avgCreditsNeeded = remainingCredits / remainingSemesters;

    let graduationStatus;
    if (avgCreditsNeeded <= 15) {
      graduationStatus = "OK";
    } else if (avgCreditsNeeded <= 18) {
      graduationStatus = "HEAVY";
    } else {
      graduationStatus = "RISKY";
    }

    return {
      remainingCredits,
      remainingSemesters,
      avgCreditsNeeded: Math.round(avgCreditsNeeded * 100) / 100,
      graduationStatus,
    };
  }

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  /**
   * Check if all prerequisites are met for a course
   * @param {Object} course - Course object with prerequisites[]
   * @param {Set} completedSet - Set of completed course codes
   * @returns {boolean}
   */
  function arePrerequisitesMet(course, completedSet) {
    if (!course.prerequisites || course.prerequisites.length === 0) {
      return true;
    }
    return course.prerequisites.every((prereq) =>
      completedSet.has(prereq.toUpperCase()),
    );
  }

  /**
   * Check if a course is allowed based on CGPA and difficulty
   * @param {Object} course - Course object with difficulty
   * @param {number} cgpa - Current CGPA
   * @returns {boolean}
   */
  function isDifficultyAllowed(course, cgpa) {
    const difficulty = (course.difficulty || "Medium").toLowerCase();

    if (cgpa < 2.75) {
      // Skip Hard courses
      return difficulty !== "hard";
    } else if (cgpa <= 3.25) {
      // Allow Easy + Medium only
      return difficulty === "easy" || difficulty === "medium";
    }
    // cgpa > 3.25 - allow all
    return true;
  }

  /**
   * Get courses for the selected major
   * @returns {Array}
   */
  function getMajorElectives() {
    if (!state.selected_major || !majorCoursesByMajor[state.selected_major]) {
      return [];
    }
    return majorCoursesByMajor[state.selected_major];
  }

  /**
   * Filter core courses by trimester
   * @param {number} trimester
   * @returns {Array}
   */
  function getCoreCoursesByTrimester(trimester) {
    return coreCourses.filter((c) => c.trimester === trimester);
  }

  // ============================================
  // MODE A: AUTO ADVISOR
  // ============================================

  /**
   * Generate an automatic semester-wise course plan
   * @returns {Object} - { semesterWisePlan: { semester_X: [course_codes] } }
   */
  function generateAutoPlan() {
    const completedSet = new Set(
      state.completed_courses.map((c) => c.toUpperCase()),
    );
    const maxCredits = state.max_credits_per_semester || 15;
    const currentSem = state.current_semester;
    const targetSem = state.target_graduation_semester;

    const semesterWisePlan = {};
    const plannedCourses = new Set();

    // Process each remaining semester
    for (let sem = currentSem; sem <= targetSem; sem++) {
      const semesterKey = `semester_${sem}`;
      semesterWisePlan[semesterKey] = [];
      let semesterCredits = 0;

      // Step 1: Add CORE courses for this trimester (if not completed)
      const coreForSem = getCoreCoursesByTrimester(sem);
      for (const course of coreForSem) {
        const code = course.course_code.toUpperCase();

        if (completedSet.has(code) || plannedCourses.has(code)) continue;
        if (!arePrerequisitesMet(course, completedSet)) continue;
        if (!isDifficultyAllowed(course, state.cgpa)) continue;

        if (semesterCredits + course.credit <= maxCredits) {
          semesterWisePlan[semesterKey].push(code);
          semesterCredits += course.credit;
          plannedCourses.add(code);
        }
      }

      // Step 2: Fill remaining credits with MAJOR_ELECTIVE
      const majorElectives = getMajorElectives();
      for (const course of majorElectives) {
        if (semesterCredits >= maxCredits) break;

        const code = course.course_code.toUpperCase();

        if (completedSet.has(code) || plannedCourses.has(code)) continue;
        if (!arePrerequisitesMet(course, completedSet)) continue;
        if (!isDifficultyAllowed(course, state.cgpa)) continue;

        if (semesterCredits + course.credit <= maxCredits) {
          semesterWisePlan[semesterKey].push(code);
          semesterCredits += course.credit;
          plannedCourses.add(code);
        }
      }

      // Step 3: Fill remaining credits with GED_ELECTIVE
      for (const course of gedCourses) {
        if (semesterCredits >= maxCredits) break;

        const code = course.course_code.toUpperCase();

        if (completedSet.has(code) || plannedCourses.has(code)) continue;
        if (!arePrerequisitesMet(course, completedSet)) continue;
        if (!isDifficultyAllowed(course, state.cgpa)) continue;

        if (semesterCredits + course.credit <= maxCredits) {
          semesterWisePlan[semesterKey].push(code);
          semesterCredits += course.credit;
          plannedCourses.add(code);
        }
      }

      // Update completed set for next semester planning
      for (const code of semesterWisePlan[semesterKey]) {
        completedSet.add(code);
      }
    }

    return { semesterWisePlan };
  }

  // ============================================
  // MODE B: CUSTOM ADVISOR
  // ============================================

  /**
   * Get slot gap between two exam slots on the same day
   * @param {string} slot1
   * @param {string} slot2
   * @returns {number} - Gap value (0 = clash, 1 = tight, 2+ = safe)
   */
  function getSlotGap(slot1, slot2) {
    const idx1 = SLOT_ORDER.indexOf(slot1);
    const idx2 = SLOT_ORDER.indexOf(slot2);

    if (idx1 === -1 || idx2 === -1) return 3; // Unknown slots treated as safe

    return Math.abs(idx1 - idx2);
  }

  /**
   * Find a course object by course code
   * @param {string} courseCode
   * @returns {Object|null}
   */
  function findCourseByCode(courseCode) {
    const normalizedCode = courseCode.toUpperCase();
    const allCourses = getAllKnownCourses();
    return (
      allCourses.find((c) => c.course_code.toUpperCase() === normalizedCode) ||
      null
    );
  }

  /**
   * Validate a custom course selection plan
   * @returns {Object} - Validation results
   */
  function validateCustomPlan() {
    const completedSet = new Set(
      state.completed_courses.map((c) => c.toUpperCase()),
    );
    const selectedCourses = state.user_selected_courses.map((c) =>
      c.toUpperCase(),
    );

    const result = {
      validCourses: [],
      blockedCourses: [],
      examClashes: [],
      tightExamPairs: [],
      selectedCredits: 0,
      remainingCredits: 0,
    };

    const validCoursesWithExam = [];

    // Step 1: Prerequisite Validation
    for (const code of selectedCourses) {
      const course = findCourseByCode(code);

      if (!course) {
        result.blockedCourses.push({
          course_code: code,
          reason: "Course not found in database",
        });
        continue;
      }

      if (!arePrerequisitesMet(course, completedSet)) {
        const missingPrereqs = course.prerequisites.filter(
          (p) => !completedSet.has(p.toUpperCase()),
        );
        result.blockedCourses.push({
          course_code: code,
          reason: `Missing prerequisites: ${missingPrereqs.join(", ")}`,
        });
        continue;
      }

      // Course is valid
      result.validCourses.push(code);
      result.selectedCredits += course.credit;

      // Store for exam clash check
      if (course.exam_day && course.exam_slot) {
        validCoursesWithExam.push({
          course_code: code,
          exam_day: course.exam_day,
          exam_slot: course.exam_slot,
        });
      }
    }

    // Step 2 & 3: Exam Clash and Tight Gap Check
    for (let i = 0; i < validCoursesWithExam.length; i++) {
      for (let j = i + 1; j < validCoursesWithExam.length; j++) {
        const c1 = validCoursesWithExam[i];
        const c2 = validCoursesWithExam[j];

        // Only check if same day
        if (c1.exam_day === c2.exam_day) {
          const gap = getSlotGap(c1.exam_slot, c2.exam_slot);

          if (gap === 0) {
            // Same slot = clash
            result.examClashes.push({
              courses: [c1.course_code, c2.course_code],
              day: c1.exam_day,
              slot: c1.exam_slot,
            });
          } else if (gap === 1) {
            // Adjacent slots = tight
            result.tightExamPairs.push({
              courses: [c1.course_code, c2.course_code],
              day: c1.exam_day,
              slots: [c1.exam_slot, c2.exam_slot],
              warning: "Back-to-back exams - limited prep time",
            });
          }
          // gap >= 2 is safe, no warning needed
        }
      }
    }

    // Step 4: Credit Summary
    result.remainingCredits =
      TOTAL_REQUIRED_CREDITS - state.completed_credits - result.selectedCredits;

    return result;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    // Initialization
    init,
    setState,

    // PDF Parsing
    extractCoursesFromPDF,
    parseCoursePlanPDF,

    // OCR (Screenshots)
    extractCompletedCoursesFromScreenshot,
    mergeCompletedCourses,

    // Graduation Status
    calculateGraduationStatus,

    // Auto Planning
    generateAutoPlan,

    // Custom Validation
    validateCustomPlan,

    // Helpers (exposed for flexibility)
    findCourseByCode,
    getAllKnownCourses,
    arePrerequisitesMet,
    isDifficultyAllowed,

    // Constants
    TOTAL_REQUIRED_CREDITS,
  };
})();

// Export for module environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = UIUAdvisor;
}
