package competency

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/academic-system/curriculum-service/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type CPLTracker struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

type CPLProfile struct {
	StudentID       string                 `json:"student_id"`
	ProgramID       string                 `json:"program_id"`
	TotalCredits     int                    `json:"total_credits"`
	EarnedCredits   int                    `json:"earned_credits"`
	CompletedCPLs   []CPLAchievement      `json:"completed_cpls"`
	InProgressCPLs  []CPLProgress        `json:"in_progress_cpls"`
	RemainingCPLs   []CPLRequirement     `json:"remaining_cpls"`
	ProgressPercentage float64               `json:"progress_percentage"`
	GPA             float64               `json:"gpa"`
	EstimatedCompletion time.Time            `json:"estimated_completion"`
	LastUpdated      time.Time            `json:"last_updated"`
}

type CPLAchievement struct {
	CPLCode         string    `json:"cpl_code"`
	CPLName         string    `json:"cpl_name"`
	Category        string    `json:"category"`
	Credits         int       `json:"credits"`
	AchievedDate    time.Time `json:"achieved_date"`
	CourseIDs       []string  `json:"course_ids"`
	Evidence        []string  `json:"evidence"`
	AssessmentScore float64   `json:"assessment_score"`
	Level          string    `json:"level"`
}

type CPLProgress struct {
	CPLCode         string    `json:"cpl_code"`
	CPLName         string    `json:"cpl_name"`
	Category        string    `json:"category"`
	RequiredCredits int       `json:"required_credits"`
	EarnedCredits  int       `json:"earned_credits"`
	ProgressPercentage float64 `json:"progress_percentage"`
	CurrentCourses  []string  `json:"current_courses"`
	NextMilestones []Milestone `json:"next_milestones"`
	EstimatedCompletion time.Time `json:"estimated_completion"`
}

type CPLRequirement struct {
	CPLCode         string    `json:"cpl_code"`
	CPLName         string    `json:"cpl_name"`
	Category        string    `json:"category"`
	RequiredCredits int       `json:"required_credits"`
	Description     string    `json:"description"`
	Prerequisites   []string  `json:"prerequisites"`
	Courses         []string  `json:"courses"`
	AssessmentMethods []string `json:"assessment_methods"`
	Level           string    `json:"level"`
	IsMandatory     bool      `json:"is_mandatory"`
}

type Milestone struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	Status      string    `json:"status"`
	Weight      float64   `json:"weight"`
}

type CompetencyMatrix struct {
	StudentID     string                    `json:"student_id"`
	ProgramID     string                    `json:"program_id"`
	Categories    map[string]CategoryProgress `json:"categories"`
	OverallScore  float64                   `json:"overall_score"`
	Strengths     []string                  `json:"strengths"`
	Weaknesses    []string                  `json:"weaknesses"`
	Recommendations []string                  `json:"recommendations"`
	LastUpdated   time.Time                  `json:"last_updated"`
}

type CategoryProgress struct {
	CategoryCode    string  `json:"category_code"`
	CategoryName    string  `json:"category_name"`
	RequiredCPLs    int     `json:"required_cpls"`
	CompletedCPLs    int     `json:"completed_cpls"`
	ProgressPercentage float64 `json:"progress_percentage"`
	AverageScore      float64 `json:"average_score"`
	Level            string  `json:"level"`
}

func NewCPLTracker(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *CPLTracker {
	return &CPLTracker{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

func (ct *CPLTracker) GetCPLProfile(ctx context.Context, studentID string) (*CPLProfile, error) {
	// Try to get from cache first
	cachedProfile, err := ct.redis.Get(ctx, fmt.Sprintf("cpl_profile:%s", studentID)).Result()
	if err == nil {
		var profile CPLProfile
		err = json.Unmarshal([]byte(cachedProfile), &profile)
		if err == nil {
			return &profile, nil
		}
	}

	// Get student's program information
	var programID string
	var totalCredits int
	query := `
		SELECT program_id, total_credits 
		FROM student_programs 
		WHERE student_id = $1 AND status = 'active'
	`
	err = ct.db.QueryRowContext(ctx, query, studentID).Scan(&programID, &totalCredits)
	if err != nil {
		return nil, fmt.Errorf("failed to get student program: %w", err)
	}

	// Get earned credits
	var earnedCredits int
	creditsQuery := `
		SELECT COALESCE(SUM(c.credits), 0)
		FROM student_courses sc
		JOIN courses c ON sc.course_id = c.id
		WHERE sc.student_id = $1 
		AND sc.status = 'completed'
		AND sc.grade_points >= 2.0
	`
	err = ct.db.QueryRowContext(ctx, creditsQuery, studentID).Scan(&earnedCredits)
	if err != nil {
		return nil, fmt.Errorf("failed to get earned credits: %w", err)
	}

	// Get student GPA
	var gpa float64
	gpaQuery := `
		SELECT COALESCE(AVG(grade_points), 0.0)
		FROM student_grades
		WHERE student_id = $1
	`
	err = ct.db.QueryRowContext(ctx, gpaQuery, studentID).Scan(&gpa)
	if err != nil {
		return nil, fmt.Errorf("failed to get GPA: %w", err)
	}

	// Get completed CPLs
	completedCPLs, err := ct.getCompletedCPLs(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get completed CPLs: %w", err)
	}

	// Get in-progress CPLs
	inProgressCPLs, err := ct.getInProgressCPLs(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get in-progress CPLs: %w", err)
	}

	// Get remaining CPLs
	remainingCPLs, err := ct.getRemainingCPLs(ctx, programID, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get remaining CPLs: %w", err)
	}

	// Calculate progress percentage
	progressPercentage := float64(earnedCredits) / float64(totalCredits) * 100

	// Estimate completion date
	estimatedCompletion := ct.estimateCompletionDate(ctx, studentID, progressPercentage)

	profile := &CPLProfile{
		StudentID:         studentID,
		ProgramID:         programID,
		TotalCredits:       totalCredits,
		EarnedCredits:     earnedCredits,
		CompletedCPLs:     completedCPLs,
		InProgressCPLs:    inProgressCPLs,
		RemainingCPLs:     remainingCPLs,
		ProgressPercentage: progressPercentage,
		GPA:               gpa,
		EstimatedCompletion: estimatedCompletion,
		LastUpdated:        time.Now(),
	}

	// Cache the profile
	profileJSON, _ := json.Marshal(profile)
	ct.redis.Set(ctx, fmt.Sprintf("cpl_profile:%s", studentID), profileJSON, time.Hour)

	return profile, nil
}

func (ct *CPLTracker) getCompletedCPLs(ctx context.Context, studentID string) ([]CPLAchievement, error) {
	query := `
		SELECT 
			cpl.code, cpl.name, cpl.category, cpl.credits,
			cpa.achieved_date, cpa.assessment_score, cpa.level,
			COALESCE(cpa.evidence, '[]') as evidence
		FROM cpl_achievements cpa
		JOIN course_program_learning cpl ON cpa.cpl_id = cpl.id
		WHERE cpa.student_id = $1
		ORDER BY cpa.achieved_date DESC
	`

	rows, err := ct.db.QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var achievements []CPLAchievement
	for rows.Next() {
		var achievement CPLAchievement
		var evidenceJSON string
		
		err := rows.Scan(
			&achievement.CPLCode, &achievement.CPLName, &achievement.Category,
			&achievement.Credits, &achievement.AchievedDate,
			&achievement.AssessmentScore, &achievement.Level, &evidenceJSON,
		)
		if err != nil {
			continue
		}

		// Parse evidence JSON
		json.Unmarshal([]byte(evidenceJSON), &achievement.Evidence)

		// Get course IDs for this CPL
		courseIDs, err := ct.getCPLCourseIDs(ctx, achievement.CPLCode, studentID)
		if err == nil {
			achievement.CourseIDs = courseIDs
		}

		achievements = append(achievements, achievement)
	}

	return achievements, nil
}

func (ct *CPLTracker) getInProgressCPLs(ctx context.Context, studentID string) ([]CPLProgress, error) {
	query := `
		WITH cpl_progress AS (
			SELECT 
				cpl.code, cpl.name, cpl.category, cpl.credits,
				COALESCE(SUM(CASE WHEN sc.status = 'completed' AND sc.grade_points >= 2.0 THEN c.credits ELSE 0 END), 0) as earned_credits,
				COALESCE(SUM(CASE WHEN sc.status = 'enrolled' THEN c.credits ELSE 0 END), 0) as in_progress_credits
			FROM course_program_learning cpl
			LEFT JOIN course_cpl_mapping ccm ON cpl.id = ccm.cpl_id
			LEFT JOIN courses c ON ccm.course_id = c.id
			LEFT JOIN student_courses sc ON c.id = sc.course_id AND sc.student_id = $1
			WHERE cpl.program_id = (SELECT program_id FROM student_programs WHERE student_id = $1 AND status = 'active')
			GROUP BY cpl.id, cpl.code, cpl.name, cpl.category, cpl.credits
		)
		SELECT 
			code, name, category, credits, earned_credits,
			(earned_credits * 100.0 / credits) as progress_percentage
		FROM cpl_progress
		WHERE earned_credits > 0 AND earned_credits < credits
		ORDER BY progress_percentage DESC
	`

	rows, err := ct.db.QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var progress []CPLProgress
	for rows.Next() {
		var p CPLProgress
		err := rows.Scan(
			&p.CPLCode, &p.CPLName, &p.Category, &p.RequiredCredits,
			&p.EarnedCredits, &p.ProgressPercentage,
		)
		if err != nil {
			continue
		}

		// Get current courses for this CPL
		currentCourses, err := ct.getCurrentCPLCourses(ctx, p.CPLCode, studentID)
		if err == nil {
			p.CurrentCourses = currentCourses
		}

		// Get next milestones
		milestones, err := ct.getCPLMilestones(ctx, p.CPLCode, studentID)
		if err == nil {
			p.NextMilestones = milestones
		}

		// Estimate completion date
		p.EstimatedCompletion = ct.estimateCPLCompletion(ctx, p.CPLCode, studentID, p.ProgressPercentage)

		progress = append(progress, p)
	}

	return progress, nil
}

func (ct *CPLTracker) getRemainingCPLs(ctx context.Context, programID, studentID string) ([]CPLRequirement, error) {
	query := `
		SELECT 
			cpl.code, cpl.name, cpl.category, cpl.credits,
			cpl.description, cpl.level, cpl.is_mandatory,
			COALESCE(cpl.prerequisites, '[]') as prerequisites,
			COALESCE(cpl.assessment_methods, '[]') as assessment_methods
		FROM course_program_learning cpl
		WHERE cpl.program_id = $1
		AND cpl.id NOT IN (
			SELECT cpl_id FROM cpl_achievements WHERE student_id = $2
		)
		ORDER BY cpl.category, cpl.level
	`

	rows, err := ct.db.QueryContext(ctx, query, programID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requirements []CPLRequirement
	for rows.Next() {
		var req CPLRequirement
		var prereqsJSON, assessmentJSON string
		
		err := rows.Scan(
			&req.CPLCode, &req.CPLName, &req.Category, &req.Credits,
			&req.Description, &req.Level, &req.IsMandatory,
			&prereqsJSON, &assessmentJSON,
		)
		if err != nil {
			continue
		}

		// Parse JSON arrays
		json.Unmarshal([]byte(prereqsJSON), &req.Prerequisites)
		json.Unmarshal([]byte(assessmentJSON), &req.AssessmentMethods)

		// Get courses for this CPL
		courses, err := ct.getCPLCourses(ctx, req.CPLCode)
		if err == nil {
			req.Courses = courses
		}

		requirements = append(requirements, req)
	}

	return requirements, nil
}

func (ct *CPLTracker) getCPLCourseIDs(ctx context.Context, cplCode, studentID string) ([]string, error) {
	query := `
		SELECT DISTINCT c.id
		FROM courses c
		JOIN course_cpl_mapping ccm ON c.id = ccm.course_id
		JOIN course_program_learning cpl ON ccm.cpl_id = cpl.id
		JOIN student_courses sc ON c.id = sc.course_id
		WHERE cpl.code = $1 AND sc.student_id = $2 AND sc.status = 'completed'
	`

	rows, err := ct.db.QueryContext(ctx, query, cplCode, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courseIDs []string
	for rows.Next() {
		var courseID string
		rows.Scan(&courseID)
		courseIDs = append(courseIDs, courseID)
	}

	return courseIDs, nil
}

func (ct *CPLTracker) getCurrentCPLCourses(ctx context.Context, cplCode, studentID string) ([]string, error) {
	query := `
		SELECT DISTINCT c.id
		FROM courses c
		JOIN course_cpl_mapping ccm ON c.id = ccm.course_id
		JOIN course_program_learning cpl ON ccm.cpl_id = cpl.id
		JOIN student_courses sc ON c.id = sc.course_id
		WHERE cpl.code = $1 AND sc.student_id = $2 AND sc.status = 'enrolled'
	`

	rows, err := ct.db.QueryContext(ctx, query, cplCode, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courseIDs []string
	for rows.Next() {
		var courseID string
		rows.Scan(&courseID)
		courseIDs = append(courseIDs, courseID)
	}

	return courseIDs, nil
}

func (ct *CPLTracker) getCPLCourses(ctx context.Context, cplCode string) ([]string, error) {
	query := `
		SELECT DISTINCT c.id
		FROM courses c
		JOIN course_cpl_mapping ccm ON c.id = ccm.course_id
		JOIN course_program_learning cpl ON ccm.cpl_id = cpl.id
		WHERE cpl.code = $1 AND c.status = 'active'
	`

	rows, err := ct.db.QueryContext(ctx, query, cplCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courseIDs []string
	for rows.Next() {
		var courseID string
		rows.Scan(&courseID)
		courseIDs = append(courseIDs, courseID)
	}

	return courseIDs, nil
}

func (ct *CPLTracker) getCPLMilestones(ctx context.Context, cplCode, studentID string) ([]Milestone, error) {
	query := `
		SELECT 
			milestone_name, description, due_date, status, weight
		FROM cpl_milestones
		WHERE cpl_code = $1 AND student_id = $2
		ORDER BY due_date ASC
	`

	rows, err := ct.db.QueryContext(ctx, query, cplCode, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var milestones []Milestone
	for rows.Next() {
		var milestone Milestone
		err := rows.Scan(
			&milestone.Name, &milestone.Description,
			&milestone.DueDate, &milestone.Status, &milestone.Weight,
		)
		if err != nil {
			continue
		}
		milestones = append(milestones, milestone)
	}

	return milestones, nil
}

func (ct *CPLTracker) estimateCompletionDate(ctx context.Context, studentID string, currentProgress float64) time.Time {
	// Get historical completion rate
	query := `
		SELECT AVG(credits_per_semester)
		FROM student_completion_history
		WHERE student_id = $1
		ORDER BY semester DESC
		LIMIT 4
	`

	var avgCreditsPerSemester float64
	err := ct.db.QueryRowContext(ctx, query, studentID).Scan(&avgCreditsPerSemester)
	if err != nil || avgCreditsPerSemester == 0 {
		// Default estimation: 15 credits per semester
		avgCreditsPerSemester = 15.0
	}

	// Get remaining credits
	var totalCredits, earnedCredits int
	creditsQuery := `
		SELECT 
			sp.total_credits, 
			COALESCE(SUM(CASE WHEN sc.status = 'completed' AND sc.grade_points >= 2.0 THEN c.credits ELSE 0 END), 0)
		FROM student_programs sp
		LEFT JOIN student_courses sc ON sp.student_id = sc.student_id
		LEFT JOIN courses c ON sc.course_id = c.id
		WHERE sp.student_id = $1 AND sp.status = 'active'
		GROUP BY sp.total_credits
	`
	err = ct.db.QueryRowContext(ctx, creditsQuery, studentID).Scan(&totalCredits, &earnedCredits)
	if err != nil {
		return time.Now().AddDate(2, 0, 0) // Default 2 years
	}

	remainingCredits := totalCredits - earnedCredits
	semestersNeeded := math.Ceil(float64(remainingCredits) / avgCreditsPerSemester)

	// Add 6 months buffer
	return time.Now().AddDate(0, int(semestersNeeded*6), 0)
}

func (ct *CPLTracker) estimateCPLCompletion(ctx context.Context, cplCode, studentID string, currentProgress float64) time.Time {
	// Get current course load and completion rate
	query := `
		SELECT 
			COUNT(CASE WHEN sc.status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate,
			AVG(CASE WHEN sc.status = 'completed' THEN 
				EXTRACT(EPOCH FROM (completion_date - enrollment_date)) / 86400
			END) as avg_completion_days
		FROM student_courses sc
		WHERE sc.student_id = $1
		AND sc.enrollment_date >= CURRENT_DATE - INTERVAL '12 months'
	`

	var completionRate float64
	var avgCompletionDays float64
	err := ct.db.QueryRowContext(ctx, query, studentID).Scan(&completionRate, &avgCompletionDays)
	if err != nil {
		return time.Now().AddDate(1, 0, 0) // Default 1 year
	}

	// Estimate based on current progress and completion rate
	remainingProgress := 100.0 - currentProgress
	estimatedDays := remainingProgress / (completionRate / avgCompletionDays)

	return time.Now().AddDate(0, 0, int(estimatedDays))
}

func (ct *CPLTracker) GetCompetencyMatrix(ctx context.Context, studentID string) (*CompetencyMatrix, error) {
	// Get student's program
	var programID string
	query := `
		SELECT program_id FROM student_programs 
		WHERE student_id = $1 AND status = 'active'
	`
	err := ct.db.QueryRowContext(ctx, query, studentID).Scan(&programID)
	if err != nil {
		return nil, fmt.Errorf("failed to get student program: %w", err)
	}

	// Get categories and their progress
	categories, err := ct.getCategoryProgress(ctx, studentID, programID)
	if err != nil {
		return nil, fmt.Errorf("failed to get category progress: %w", err)
	}

	// Calculate overall score
	overallScore := ct.calculateOverallScore(categories)

	// Identify strengths and weaknesses
	strengths, weaknesses := ct.identifyStrengthsWeaknesses(categories)

	// Generate recommendations
	recommendations := ct.generateCompetencyRecommendations(categories, strengths, weaknesses)

	matrix := &CompetencyMatrix{
		StudentID:      studentID,
		ProgramID:      programID,
		Categories:     categories,
		OverallScore:   overallScore,
		Strengths:      strengths,
		Weaknesses:     weaknesses,
		Recommendations: recommendations,
		LastUpdated:    time.Now(),
	}

	return matrix, nil
}

func (ct *CPLTracker) getCategoryProgress(ctx context.Context, studentID, programID string) (map[string]CategoryProgress, error) {
	query := `
		WITH category_stats AS (
			SELECT 
				cpl.category,
				cpl.category_code,
				COUNT(DISTINCT cpl.id) as total_cpls,
				COUNT(DISTINCT CASE WHEN cpa.student_id IS NOT NULL THEN cpl.id END) as completed_cpls,
				AVG(COALESCE(cpa.assessment_score, 0)) as avg_score,
				MAX(cpl.level) as max_level
			FROM course_program_learning cpl
			LEFT JOIN cpl_achievements cpa ON cpl.id = cpa.cpl_id AND cpa.student_id = $1
			WHERE cpl.program_id = $2
			GROUP BY cpl.category, cpl.category_code
		)
		SELECT 
			category_code, category_name, total_cpls, completed_cpls,
			(completed_cpls * 100.0 / total_cpls) as progress_percentage,
			avg_score, max_level
		FROM category_stats
		ORDER BY category_name
	`

	rows, err := ct.db.QueryContext(ctx, query, studentID, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make(map[string]CategoryProgress)
	for rows.Next() {
		var cat CategoryProgress
		err := rows.Scan(
			&cat.CategoryCode, &cat.CategoryName, &cat.RequiredCPLs,
			&cat.CompletedCPLs, &cat.ProgressPercentage,
			&cat.AverageScore, &cat.Level,
		)
		if err != nil {
			continue
		}

		categories[cat.CategoryCode] = cat
	}

	return categories, nil
}

func (ct *CPLTracker) calculateOverallScore(categories map[string]CategoryProgress) float64 {
	if len(categories) == 0 {
		return 0
	}

	totalScore := 0.0
	for _, category := range categories {
		totalScore += category.AverageScore
	}

	return totalScore / float64(len(categories))
}

func (ct *CPLTracker) identifyStrengthsWeaknesses(categories map[string]CategoryProgress) ([]string, []string) {
	var strengths, weaknesses []string

	for code, category := range categories {
		if category.ProgressPercentage >= 80 && category.AverageScore >= 3.5 {
			strengths = append(strengths, fmt.Sprintf("%s (%.1f%% progress, %.1f avg score)", 
				category.CategoryName, category.ProgressPercentage, category.AverageScore))
		} else if category.ProgressPercentage < 50 || category.AverageScore < 2.5 {
			weaknesses = append(weaknesses, fmt.Sprintf("%s (%.1f%% progress, %.1f avg score)", 
				category.CategoryName, category.ProgressPercentage, category.AverageScore))
		}
	}

	return strengths, weaknesses
}

func (ct *CPLTracker) generateCompetencyRecommendations(categories map[string]CategoryProgress, strengths, weaknesses []string) []string {
	var recommendations []string

	// General recommendations based on overall progress
	totalProgress := 0.0
	for _, category := range categories {
		totalProgress += category.ProgressPercentage
	}
	avgProgress := totalProgress / float64(len(categories))

	if avgProgress < 50 {
		recommendations = append(recommendations, "Focus on completing foundational courses in all categories")
	} else if avgProgress < 75 {
		recommendations = append(recommendations, "Continue building on your strengths while addressing weaker areas")
	} else {
		recommendations = append(recommendations, "Focus on advanced courses and specialization areas")
	}

	// Specific recommendations based on weaknesses
	for _, weakness := range weaknesses {
		if len(weaknesses) > 0 {
			recommendations = append(recommendations, fmt.Sprintf("Prioritize improvement in: %s", weakness))
		}
	}

	// Recommendations based on strengths
	if len(strengths) > 0 {
		recommendations = append(recommendations, "Consider advanced courses in your strong areas")
	}

	return recommendations
}

func (ct *CPLTracker) UpdateCPLAchievement(ctx context.Context, studentID, cplCode string, achievement *CPLAchievement) error {
	// Start transaction
	tx, err := ct.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Insert or update achievement
	query := `
		INSERT INTO cpl_achievements (
			student_id, cpl_id, achieved_date, assessment_score, 
			level, evidence, created_at, updated_at
		) VALUES (
			$1, (SELECT id FROM course_program_learning WHERE code = $2),
			$3, $4, $5, $6, NOW(), NOW()
		)
		ON CONFLICT (student_id, cpl_id) 
		DO UPDATE SET 
			achieved_date = EXCLUDED.achieved_date,
			assessment_score = EXCLUDED.assessment_score,
			level = EXCLUDED.level,
			evidence = EXCLUDED.evidence,
			updated_at = NOW()
	`

	evidenceJSON, _ := json.Marshal(achievement.Evidence)
	_, err = tx.ExecContext(ctx, query, studentID, cplCode, achievement.AchievedDate,
		achievement.AssessmentScore, achievement.Level, evidenceJSON)
	if err != nil {
		return fmt.Errorf("failed to update CPL achievement: %w", err)
	}

	// Update student progress tracking
	err = ct.updateStudentProgress(ctx, tx, studentID)
	if err != nil {
		return fmt.Errorf("failed to update student progress: %w", err)
	}

	// Commit transaction
	err = tx.Commit()
	if err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Clear cache
	ct.redis.Del(ctx, fmt.Sprintf("cpl_profile:%s", studentID))
	ct.redis.Del(ctx, fmt.Sprintf("competency_matrix:%s", studentID))

	return nil
}

func (ct *CPLTracker) updateStudentProgress(ctx context.Context, tx *sql.Tx, studentID string) error {
	// Update overall progress in student_programs table
	query := `
		UPDATE student_programs 
		SET 
			earned_credits = (
				SELECT COALESCE(SUM(c.credits), 0)
				FROM student_courses sc
				JOIN courses c ON sc.course_id = c.id
				WHERE sc.student_id = $1 
				AND sc.status = 'completed'
				AND sc.grade_points >= 2.0
			),
			progress_percentage = (
				SELECT (earned_credits * 100.0 / total_credits)
				FROM student_programs
				WHERE student_id = $1 AND status = 'active'
			),
			updated_at = NOW()
		WHERE student_id = $1 AND status = 'active'
	`

	_, err := tx.ExecContext(ctx, query, studentID)
	return err
}

func (ct *CPLTracker) GenerateCPLReport(ctx context.Context, studentID string) (map[string]interface{}, error) {
	profile, err := ct.GetCPLProfile(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get CPL profile: %w", err)
	}

	matrix, err := ct.GetCompetencyMatrix(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get competency matrix: %w", err)
	}

	// Generate comprehensive report
	report := map[string]interface{}{
		"student_id":         studentID,
		"generated_at":        time.Now(),
		"cpl_profile":        profile,
		"competency_matrix":   matrix,
		"summary": map[string]interface{}{
			"total_credits":       profile.TotalCredits,
			"earned_credits":      profile.EarnedCredits,
			"progress_percentage": profile.ProgressPercentage,
			"gpa":                profile.GPA,
			"completed_cpls":      len(profile.CompletedCPLs),
			"in_progress_cpls":    len(profile.InProgressCPLs),
			"remaining_cpls":      len(profile.RemainingCPLs),
		},
		"recommendations": matrix.Recommendations,
		"next_steps": ct.generateNextSteps(profile, matrix),
	}

	return report, nil
}

func (ct *CPLTracker) generateNextSteps(profile *CPLProfile, matrix *CompetencyMatrix) []string {
	var nextSteps []string

	// Based on progress percentage
	if profile.ProgressPercentage < 25 {
		nextSteps = append(nextSteps, "Focus on completing foundational courses")
	} else if profile.ProgressPercentage < 50 {
		nextSteps = append(nextSteps, "Continue building core competencies")
	} else if profile.ProgressPercentage < 75 {
		nextSteps = append(nextSteps, "Start working on specialization areas")
	} else {
		nextSteps = append(nextSteps, "Complete remaining requirements and prepare for graduation")
	}

	// Based on weaknesses
	if len(matrix.Weaknesses) > 0 {
		nextSteps = append(nextSteps, "Address competency gaps in weak areas")
	}

	// Based on GPA
	if profile.GPA < 2.5 {
		nextSteps = append(nextSteps, "Improve academic performance through tutoring and study support")
	}

	return nextSteps
}
