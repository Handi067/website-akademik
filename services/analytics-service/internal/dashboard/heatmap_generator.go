package dashboard

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/academic-system/analytics-service/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type HeatmapGenerator struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

type AcademicHeatmap struct {
	StudentID      string                    `json:"student_id"`
	ProgramID      string                    `json:"program_id"`
	Period         string                    `json:"period"`
	HeatmapData    map[string]HeatmapCell   `json:"heatmap_data"`
	Summary        HeatmapSummary            `json:"summary"`
	Insights       []string                  `json:"insights"`
	Recommendations []string                  `json:"recommendations"`
	GeneratedAt    time.Time                 `json:"generated_at"`
}

type HeatmapCell struct {
	CourseID       string  `json:"course_id"`
	CourseName     string  `json:"course_name"`
	Performance    float64 `json:"performance"`
	Engagement    float64 `json:"engagement"`
	Attendance    float64 `json:"attendance"`
	OverallScore  float64 `json:"overall_score"`
	RiskLevel     string  `json:"risk_level"`
	Trend         string  `json:"trend"`
	PeersAverage  float64 `json:"peers_average"`
	Rank          int     `json:"rank"`
}

type HeatmapSummary struct {
	TotalCourses       int     `json:"total_courses"`
	AverageScore      float64 `json:"average_score"`
	HighPerforming    int     `json:"high_performing"`
	AveragePerforming int     `json:"average_performing"`
	LowPerforming     int     `json:"low_performing"`
	AtRiskCourses     int     `json:"at_risk_courses"`
	TopPerformingCourse string `json:"top_performing_course"`
	LowestPerformingCourse string `json:"lowest_performing_course"`
	OverallTrend     string  `json:"overall_trend"`
}

type ProgramHeatmap struct {
	ProgramID      string                    `json:"program_id"`
	ProgramName    string                    `json:"program_name"`
	Period         string                    `json:"period"`
	HeatmapData    map[string]ProgramCell   `json:"heatmap_data"`
	Summary        ProgramSummary            `json:"summary"`
	Insights       []string                  `json:"insights"`
	Recommendations []string                  `json:"recommendations"`
	GeneratedAt    time.Time                 `json:"generated_at"`
}

type ProgramCell struct {
	CourseID       string  `json:"course_id"`
	CourseName     string  `json:"course_name"`
	Difficulty     float64 `json:"difficulty"`
	EnrollmentRate float64 `json:"enrollment_rate"`
	CompletionRate float64 `json:"completion_rate"`
	AverageGrade   float64 `json:"average_grade"`
	DropoutRate    float64 `json:"dropout_rate"`
	Popularity     float64 `json:"popularity"`
	Efficiency     float64 `json:"efficiency"`
}

type ProgramSummary struct {
	TotalCourses       int     `json:"total_courses"`
	AverageDifficulty  float64 `json:"average_difficulty"`
	AverageCompletion float64 `json:"average_completion"`
	AverageGrade      float64 `json:"average_grade"`
	OverallDropout   float64 `json:"overall_dropout"`
	TopCourses       []string `json:"top_courses"`
	ProblemCourses   []string `json:"problem_courses"`
	EfficiencyScore  float64 `json:"efficiency_score"`
}

func NewHeatmapGenerator(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *HeatmapGenerator {
	return &HeatmapGenerator{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

func (hg *HeatmapGenerator) GenerateStudentHeatmap(ctx context.Context, studentID, period string) (*AcademicHeatmap, error) {
	// Try to get from cache first
	cacheKey := fmt.Sprintf("student_heatmap:%s:%s", studentID, period)
	cachedHeatmap, err := hg.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var heatmap AcademicHeatmap
		err = json.Unmarshal([]byte(cachedHeatmap), &heatmap)
		if err == nil {
			return &heatmap, nil
		}
	}

	// Get student's program
	var programID string
	query := `
		SELECT program_id FROM student_programs 
		WHERE student_id = $1 AND status = 'active'
	`
	err = hg.db.QueryRowContext(ctx, query, studentID).Scan(&programID)
	if err != nil {
		return nil, fmt.Errorf("failed to get student program: %w", err)
	}

	// Get course data for heatmap
	courseData, err := hg.getStudentCourseData(ctx, studentID, period)
	if err != nil {
		return nil, fmt.Errorf("failed to get course data: %w", err)
	}

	// Generate heatmap cells
	heatmapData := make(map[string]HeatmapCell)
	for _, data := range courseData {
		cell := hg.calculateHeatmapCell(data, studentID)
		heatmapData[data.CourseID] = cell
	}

	// Generate summary
	summary := hg.calculateStudentSummary(heatmapData)

	// Generate insights and recommendations
	insights := hg.generateStudentInsights(heatmapData, summary)
	recommendations := hg.generateStudentRecommendations(heatmapData, summary)

	heatmap := &AcademicHeatmap{
		StudentID:      studentID,
		ProgramID:      programID,
		Period:         period,
		HeatmapData:    heatmapData,
		Summary:        summary,
		Insights:       insights,
		Recommendations: recommendations,
		GeneratedAt:    time.Now(),
	}

	// Cache the heatmap
	heatmapJSON, _ := json.Marshal(heatmap)
	hg.redis.Set(ctx, cacheKey, heatmapJSON, time.Hour)

	return heatmap, nil
}

func (hg *HeatmapGenerator) getStudentCourseData(ctx context.Context, studentID, period string) ([]CourseData, error) {
	// Determine date range based on period
	dateRange := hg.getDateRange(period)

	query := `
		SELECT 
			c.id as course_id, c.name as course_name, c.credits,
			COALESCE(sg.grade_points, 0) as grade_points,
			COALESCE(sg.letter_grade, 'N/A') as letter_grade,
			COALESCE(
				COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / 
				NULLIF(COUNT(*), 0), 0
			) as attendance_rate,
			COALESCE(
				COUNT(CASE WHEN sa.submitted_at IS NOT NULL THEN 1 END) * 100.0 / 
				NULLIF(COUNT(*), 0), 0
			) as assignment_completion_rate,
			COALESCE(
				COUNT(DISTINCT CASE WHEN fp.created_at >= $2 THEN fp.id END), 0
			) as forum_posts,
			COALESCE(
				COUNT(DISTINCT DATE(ual.login_time)), 0
			) as login_days,
			COALESCE(AVG(stt.study_hours), 0) as avg_study_hours
		FROM courses c
		LEFT JOIN student_grades sg ON c.id = sg.course_id AND sg.student_id = $1
		LEFT JOIN attendance a ON c.id = a.course_id AND a.student_id = $1
		LEFT JOIN course_sessions cs ON a.session_id = cs.id AND cs.session_date BETWEEN $2 AND $3
		LEFT JOIN student_assignments sa ON c.id = sa.course_id AND sa.student_id = $1
		LEFT JOIN assignments a2 ON sa.assignment_id = a2.id AND a2.due_date BETWEEN $2 AND $3
		LEFT JOIN forum_posts fp ON c.id = fp.course_id AND fp.student_id = $1 AND fp.created_at BETWEEN $2 AND $3
		LEFT JOIN user_activity_log ual ON ual.user_id = $1 AND ual.login_time BETWEEN $2 AND $3
		LEFT JOIN study_time_tracking stt ON stt.student_id = $1 AND stt.tracking_date BETWEEN $2 AND $3
		WHERE c.id IN (
			SELECT course_id FROM student_courses 
			WHERE student_id = $1 AND status IN ('enrolled', 'completed')
		)
		GROUP BY c.id, c.name, c.credits, sg.grade_points, sg.letter_grade
		ORDER BY c.name
	`

	rows, err := hg.db.QueryContext(ctx, query, studentID, dateRange.Start, dateRange.End)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courseData []CourseData
	for rows.Next() {
		var data CourseData
		err := rows.Scan(
			&data.CourseID, &data.CourseName, &data.Credits,
			&data.GradePoints, &data.LetterGrade, &data.AttendanceRate,
			&data.AssignmentCompletionRate, &data.ForumPosts, &data.LoginDays,
			&data.AvgStudyHours,
		)
		if err != nil {
			continue
		}

		// Get peer comparison data
		peerData, err := hg.getPeerComparison(ctx, data.CourseID, studentID)
		if err == nil {
			data.PeersAverage = peerData.AverageGrade
			data.Rank = peerData.Rank
		}

		courseData = append(courseData, data)
	}

	return courseData, nil
}

type CourseData struct {
	CourseID                string  `json:"course_id"`
	CourseName              string  `json:"course_name"`
	Credits                 int     `json:"credits"`
	GradePoints             float64 `json:"grade_points"`
	LetterGrade             string  `json:"letter_grade"`
	AttendanceRate          float64 `json:"attendance_rate"`
	AssignmentCompletionRate float64 `json:"assignment_completion_rate"`
	ForumPosts             int     `json:"forum_posts"`
	LoginDays              int     `json:"login_days"`
	AvgStudyHours          float64 `json:"avg_study_hours"`
	PeersAverage           float64 `json:"peers_average"`
	Rank                   int     `json:"rank"`
}

type PeerData struct {
	AverageGrade float64 `json:"average_grade"`
	Rank        int     `json:"rank"`
}

func (hg *HeatmapGenerator) getPeerComparison(ctx context.Context, courseID, studentID string) (*PeerData, error) {
	query := `
		WITH student_grades AS (
			SELECT 
				sg.student_id,
				COALESCE(sg.grade_points, 0) as grade_points
			FROM student_grades sg
			WHERE sg.course_id = $1
			AND sg.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
		),
		grade_stats AS (
			SELECT 
				AVG(grade_points) as avg_grade,
				COUNT(*) as total_students
			FROM student_grades
		),
		student_rank AS (
			SELECT 
				sg.student_id,
				RANK() OVER (ORDER BY sg.grade_points DESC) as rank
			FROM student_grades sg
			WHERE sg.course_id = $1
			AND sg.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
		)
		SELECT 
			gs.avg_grade,
			sr.rank
		FROM grade_stats gs, student_rank sr
		WHERE sr.student_id = $2
	`

	var peerData PeerData
	err := hg.db.QueryRowContext(ctx, query, courseID, studentID).Scan(&peerData.AverageGrade, &peerData.Rank)
	if err != nil {
		return nil, err
	}

	return &peerData, nil
}

func (hg *HeatmapGenerator) calculateHeatmapCell(data CourseData, studentID string) HeatmapCell {
	// Calculate performance score (40% weight)
	performanceScore := (data.GradePoints / 4.0) * 100

	// Calculate engagement score (30% weight)
	engagementScore := hg.calculateEngagementScore(data)

	// Calculate attendance score (20% weight)
	attendanceScore := data.AttendanceRate

	// Calculate trend score (10% weight)
	trendScore := hg.calculateTrendScore(studentID, data.CourseID)

	// Calculate overall score
	overallScore := (performanceScore * 0.4) + (engagementScore * 0.3) + 
		(attendanceScore * 0.2) + (trendScore * 0.1)

	// Determine risk level
	riskLevel := hg.determineRiskLevel(overallScore, data.AttendanceRate)

	// Determine trend
	trend := hg.determineTrend(studentID, data.CourseID)

	return HeatmapCell{
		CourseID:      data.CourseID,
		CourseName:    data.CourseName,
		Performance:   performanceScore,
		Engagement:    engagementScore,
		Attendance:    attendanceScore,
		OverallScore:  overallScore,
		RiskLevel:     riskLevel,
		Trend:         trend,
		PeersAverage:  data.PeersAverage,
		Rank:          data.Rank,
	}
}

func (hg *HeatmapGenerator) calculateEngagementScore(data CourseData) float64 {
	// Normalize different engagement metrics
	assignmentScore := math.Min(data.AssignmentCompletionRate, 100)
	forumScore := math.Min(float64(data.ForumPosts)*10, 100) // 10 posts = 100%
	loginScore := math.Min(float64(data.LoginDays)*3.33, 100) // 30 days = 100%
	studyScore := math.Min(data.AvgStudyHours*12.5, 100) // 8 hours = 100%

	// Weighted average
	return (assignmentScore*0.4 + forumScore*0.2 + loginScore*0.2 + studyScore*0.2)
}

func (hg *HeatmapGenerator) calculateTrendScore(studentID, courseID string) float64 {
	// Get historical performance trend
	query := `
		WITH monthly_grades AS (
			SELECT 
				EXTRACT(MONTH FROM created_at) as month,
				AVG(grade_points) as avg_grade
			FROM student_grades
			WHERE student_id = $1 AND course_id = $2
			AND created_at >= CURRENT_DATE - INTERVAL '6 months'
			GROUP BY EXTRACT(MONTH FROM created_at)
			ORDER BY month
		)
		SELECT 
			COALESCE(
				(LAST_VALUE(avg_grade) OVER (ORDER BY month) - 
				 FIRST_VALUE(avg_grade) OVER (ORDER BY month)) / 
				NULLIF(FIRST_VALUE(avg_grade) OVER (ORDER BY month), 0), 0
			) as trend
		FROM monthly_grades
		LIMIT 1
	`

	var trend float64
	err := hg.db.QueryRowContext(ctx, query, studentID, courseID).Scan(&trend)
	if err != nil {
		return 50 // Default neutral trend
	}

	// Convert trend to 0-100 scale
	if trend > 0.1 {
		return 80 // Strong positive trend
	} else if trend > 0 {
		return 60 // Positive trend
	} else if trend > -0.1 {
		return 40 // Negative trend
	} else {
		return 20 // Strong negative trend
	}
}

func (hg *HeatmapGenerator) determineRiskLevel(overallScore, attendanceRate float64) string {
	if overallScore >= 80 && attendanceRate >= 85 {
		return "low"
	} else if overallScore >= 60 && attendanceRate >= 70 {
		return "medium"
	} else if overallScore >= 40 && attendanceRate >= 50 {
		return "high"
	} else {
		return "critical"
	}
}

func (hg *HeatmapGenerator) determineTrend(studentID, courseID string) string {
	query := `
		WITH recent_grades AS (
			SELECT grade_points, created_at
			FROM student_grades
			WHERE student_id = $1 AND course_id = $2
			ORDER BY created_at DESC
			LIMIT 3
		)
		SELECT 
			CASE 
				WHEN COUNT(*) < 2 THEN 'stable'
				WHEN LAG(grade_points) OVER (ORDER BY created_at) < grade_points THEN 'improving'
				WHEN LAG(grade_points) OVER (ORDER BY created_at) > grade_points THEN 'declining'
				ELSE 'stable'
			END as trend
		FROM recent_grades
		ORDER BY created_at DESC
		LIMIT 1
	`

	var trend string
	err := hg.db.QueryRowContext(ctx, query, studentID, courseID).Scan(&trend)
	if err != nil {
		return "stable"
	}

	return trend
}

func (hg *HeatmapGenerator) calculateStudentSummary(heatmapData map[string]HeatmapCell) HeatmapSummary {
	if len(heatmapData) == 0 {
		return HeatmapSummary{}
	}

	totalScore := 0.0
	highPerforming := 0
	averagePerforming := 0
	lowPerforming := 0
	atRiskCourses := 0

	var topScore float64 = -1
	var bottomScore float64 = 101
	var topCourse, bottomCourse string

	for _, cell := range heatmapData {
		totalScore += cell.OverallScore

		if cell.OverallScore >= 80 {
			highPerforming++
		} else if cell.OverallScore >= 60 {
			averagePerforming++
		} else if cell.OverallScore >= 40 {
			lowPerforming++
		} else {
			atRiskCourses++
		}

		if cell.OverallScore > topScore {
			topScore = cell.OverallScore
			topCourse = cell.CourseName
		}

		if cell.OverallScore < bottomScore {
			bottomScore = cell.OverallScore
			bottomCourse = cell.CourseName
		}
	}

	averageScore := totalScore / float64(len(heatmapData))
	overallTrend := hg.calculateOverallTrend(heatmapData)

	return HeatmapSummary{
		TotalCourses:           len(heatmapData),
		AverageScore:          averageScore,
		HighPerforming:        highPerforming,
		AveragePerforming:      averagePerforming,
		LowPerforming:         lowPerforming,
		AtRiskCourses:         atRiskCourses,
		TopPerformingCourse:   topCourse,
		LowestPerformingCourse: bottomCourse,
		OverallTrend:         overallTrend,
	}
}

func (hg *HeatmapGenerator) calculateOverallTrend(heatmapData map[string]HeatmapCell) string {
	improving := 0
	declining := 0
	stable := 0

	for _, cell := range heatmapData {
		switch cell.Trend {
		case "improving":
			improving++
		case "declining":
			declining++
		default:
			stable++
		}
	}

	if improving > declining && improving > stable {
		return "improving"
	} else if declining > improving && declining > stable {
		return "declining"
	} else {
		return "stable"
	}
}

func (hg *HeatmapGenerator) generateStudentInsights(heatmapData map[string]HeatmapCell, summary HeatmapSummary) []string {
	var insights []string

	// Overall performance insights
	if summary.AverageScore >= 80 {
		insights = append(insights, "Excellent overall academic performance across all courses")
	} else if summary.AverageScore >= 60 {
		insights = append(insights, "Good academic performance with room for improvement")
	} else {
		insights = append(insights, "Academic performance needs significant attention")
	}

	// Risk insights
	if summary.AtRiskCourses > 0 {
		insights = append(insights, fmt.Sprintf("%d courses require immediate attention", summary.AtRiskCourses))
	}

	// Trend insights
	switch summary.OverallTrend {
	case "improving":
		insights = append(insights, "Positive academic trend - keep up the good work!")
	case "declining":
		insights = append(insights, "Declining academic trend - consider intervention")
	}

	// Performance distribution insights
	if summary.HighPerforming > summary.LowPerforming {
		insights = append(insights, "Strong performance in multiple courses")
	} else if summary.LowPerforming > summary.HighPerforming {
		insights = append(insights, "Need to focus on improving overall performance")
	}

	return insights
}

func (hg *HeatmapGenerator) generateStudentRecommendations(heatmapData map[string]HeatmapCell, summary HeatmapSummary) []string {
	var recommendations []string

	// Based on overall performance
	if summary.AverageScore < 60 {
		recommendations = append(recommendations, "Consider academic counseling and tutoring services")
	}

	// Based on at-risk courses
	if summary.AtRiskCourses > 0 {
		recommendations = append(recommendations, "Focus on improving performance in at-risk courses")
		recommendations = append(recommendations, "Meet with instructors for struggling courses")
	}

	// Based on trend
	if summary.OverallTrend == "declining" {
		recommendations = append(recommendations, "Review study habits and time management")
		recommendations = append(recommendations, "Consider forming study groups")
	}

	// Based on specific course performance
	for _, cell := range heatmapData {
		if cell.Attendance < 70 {
			recommendations = append(recommendations, fmt.Sprintf("Improve attendance in %s", cell.CourseName))
		}
		if cell.Engagement < 60 {
			recommendations = append(recommendations, fmt.Sprintf("Increase engagement in %s", cell.CourseName))
		}
	}

	return recommendations
}

func (hg *HeatmapGenerator) GenerateProgramHeatmap(ctx context.Context, programID, period string) (*ProgramHeatmap, error) {
	// Try to get from cache first
	cacheKey := fmt.Sprintf("program_heatmap:%s:%s", programID, period)
	cachedHeatmap, err := hg.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var heatmap ProgramHeatmap
		err = json.Unmarshal([]byte(cachedHeatmap), &heatmap)
		if err == nil {
			return &heatmap, nil
		}
	}

	// Get program data
	programData, err := hg.getProgramData(ctx, programID, period)
	if err != nil {
		return nil, fmt.Errorf("failed to get program data: %w", err)
	}

	// Generate heatmap cells
	heatmapData := make(map[string]ProgramCell)
	for _, data := range programData {
		cell := hg.calculateProgramCell(data)
		heatmapData[data.CourseID] = cell
	}

	// Generate summary
	summary := hg.calculateProgramSummary(heatmapData)

	// Generate insights and recommendations
	insights := hg.generateProgramInsights(heatmapData, summary)
	recommendations := hg.generateProgramRecommendations(heatmapData, summary)

	heatmap := &ProgramHeatmap{
		ProgramID:      programID,
		Period:         period,
		HeatmapData:    heatmapData,
		Summary:        summary,
		Insights:       insights,
		Recommendations: recommendations,
		GeneratedAt:    time.Now(),
	}

	// Cache the heatmap
	heatmapJSON, _ := json.Marshal(heatmap)
	hg.redis.Set(ctx, cacheKey, heatmapJSON, time.Hour)

	return heatmap, nil
}

func (hg *HeatmapGenerator) getProgramData(ctx context.Context, programID, period string) ([]ProgramCourseData, error) {
	dateRange := hg.getDateRange(period)

	query := `
		SELECT 
			c.id as course_id, c.name as course_name, c.credits, c.difficulty,
			COUNT(DISTINCT sc.student_id) as enrolled_students,
			COUNT(DISTINCT CASE WHEN sc.status = 'completed' THEN sc.student_id END) as completed_students,
			COALESCE(AVG(sg.grade_points), 0) as average_grade,
			COALESCE(
				COUNT(DISTINCT CASE WHEN sc.status = 'dropped_out' THEN sc.student_id END) * 100.0 / 
				NULLIF(COUNT(DISTINCT sc.student_id), 0), 0
			) as dropout_rate,
			COALESCE(AVG(c.rating), 0) as average_rating
		FROM courses c
		LEFT JOIN student_courses sc ON c.id = sc.course_id 
			AND sc.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
		LEFT JOIN student_grades sg ON c.id = sg.course_id AND sc.student_id = sg.student_id
		WHERE c.program_id = $1
		AND c.status = 'active'
		GROUP BY c.id, c.name, c.credits, c.difficulty
		ORDER BY c.name
	`

	rows, err := hg.db.QueryContext(ctx, query, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var programData []ProgramCourseData
	for rows.Next() {
		var data ProgramCourseData
		err := rows.Scan(
			&data.CourseID, &data.CourseName, &data.Credits, &data.Difficulty,
			&data.EnrolledStudents, &data.CompletedStudents, &data.AverageGrade,
			&data.DropoutRate, &data.AverageRating,
		)
		if err != nil {
			continue
		}

		// Calculate derived metrics
		if data.EnrolledStudents > 0 {
			data.CompletionRate = float64(data.CompletedStudents) / float64(data.EnrolledStudents) * 100
			data.EnrollmentRate = float64(data.EnrolledStudents) // Raw number for now
		}

		programData = append(programData, data)
	}

	return programData, nil
}

type ProgramCourseData struct {
	CourseID         string  `json:"course_id"`
	CourseName       string  `json:"course_name"`
	Credits          int     `json:"credits"`
	Difficulty       float64 `json:"difficulty"`
	EnrolledStudents int     `json:"enrolled_students"`
	CompletedStudents int     `json:"completed_students"`
	CompletionRate   float64 `json:"completion_rate"`
	AverageGrade     float64 `json:"average_grade"`
	DropoutRate      float64 `json:"dropout_rate"`
	AverageRating    float64 `json:"average_rating"`
	EnrollmentRate    float64 `json:"enrollment_rate"`
}

func (hg *HeatmapGenerator) calculateProgramCell(data ProgramCourseData) ProgramCell {
	// Calculate efficiency (completion rate vs difficulty)
	efficiency := data.CompletionRate * (1.0 - data.Difficulty)

	// Calculate popularity (enrollment + rating)
	popularity := (data.EnrollmentRate / 100.0 * 0.6) + (data.AverageRating / 5.0 * 0.4)

	return ProgramCell{
		CourseID:       data.CourseID,
		CourseName:     data.CourseName,
		Difficulty:     data.Difficulty,
		EnrollmentRate: data.EnrollmentRate,
		CompletionRate: data.CompletionRate,
		AverageGrade:   data.AverageGrade,
		DropoutRate:    data.DropoutRate,
		Popularity:     popularity,
		Efficiency:     efficiency,
	}
}

func (hg *HeatmapGenerator) calculateProgramSummary(heatmapData map[string]ProgramCell) ProgramSummary {
	if len(heatmapData) == 0 {
		return ProgramSummary{}
	}

	totalDifficulty := 0.0
	totalCompletion := 0.0
	totalGrade := 0.0
	totalDropout := 0.0
	totalEfficiency := 0.0

	var topCourses []string
	var problemCourses []string

	for _, cell := range heatmapData {
		totalDifficulty += cell.Difficulty
		totalCompletion += cell.CompletionRate
		totalGrade += cell.AverageGrade
		totalDropout += cell.DropoutRate
		totalEfficiency += cell.Efficiency

		// Identify top courses (high completion, high grade, low dropout)
		if cell.CompletionRate >= 85 && cell.AverageGrade >= 3.5 && cell.DropoutRate <= 5 {
			topCourses = append(topCourses, cell.CourseName)
		}

		// Identify problem courses (low completion, low grade, high dropout)
		if cell.CompletionRate <= 60 || cell.AverageGrade <= 2.0 || cell.DropoutRate >= 20 {
			problemCourses = append(problemCourses, cell.CourseName)
		}
	}

	return ProgramSummary{
		TotalCourses:      len(heatmapData),
		AverageDifficulty: totalDifficulty / float64(len(heatmapData)),
		AverageCompletion: totalCompletion / float64(len(heatmapData)),
		AverageGrade:      totalGrade / float64(len(heatmapData)),
		OverallDropout:   totalDropout / float64(len(heatmapData)),
		TopCourses:       topCourses,
		ProblemCourses:   problemCourses,
		EfficiencyScore:  totalEfficiency / float64(len(heatmapData)),
	}
}

func (hg *HeatmapGenerator) generateProgramInsights(heatmapData map[string]ProgramCell, summary ProgramSummary) []string {
	var insights []string

	// Overall program health
	if summary.EfficiencyScore >= 0.8 {
		insights = append(insights, "Program is performing efficiently with high completion rates")
	} else if summary.EfficiencyScore >= 0.6 {
		insights = append(insights, "Program performance is satisfactory with room for improvement")
	} else {
		insights = append(insights, "Program requires attention due to low efficiency")
	}

	// Dropout insights
	if summary.OverallDropout > 15 {
		insights = append(insights, "High dropout rate requires intervention")
	} else if summary.OverallDropout > 10 {
		insights = append(insights, "Moderate dropout rate needs monitoring")
	}

	// Course insights
	if len(summary.ProblemCourses) > 0 {
		insights = append(insights, fmt.Sprintf("%d courses need immediate attention", len(summary.ProblemCourses)))
	}

	return insights
}

func (hg *HeatmapGenerator) generateProgramRecommendations(heatmapData map[string]ProgramCell, summary ProgramSummary) []string {
	var recommendations []string

	// Based on dropout rate
	if summary.OverallDropout > 15 {
		recommendations = append(recommendations, "Review curriculum difficulty and student support services")
		recommendations = append(recommendations, "Implement early warning system for at-risk students")
	}

	// Based on completion rate
	if summary.AverageCompletion < 70 {
		recommendations = append(recommendations, "Improve course content and delivery methods")
		recommendations = append(recommendations, "Provide additional academic support resources")
	}

	// Based on problem courses
	if len(summary.ProblemCourses) > 0 {
		recommendations = append(recommendations, "Conduct course review for underperforming courses")
		recommendations = append(recommendations, "Provide faculty development for struggling courses")
	}

	return recommendations
}

func (hg *HeatmapGenerator) getDateRange(period string) DateRange {
	now := time.Now()
	
	switch period {
	case "current_semester":
		// Assuming semester starts in January and August
		if now.Month() >= 8 {
			return DateRange{
				Start: time.Date(now.Year(), 8, 1, 0, 0, 0, 0, now.Location()),
				End:   time.Date(now.Year(), 12, 31, 23, 59, 59, 0, now.Location()),
			}
		} else {
			return DateRange{
				Start: time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()),
				End:   time.Date(now.Year(), 7, 31, 23, 59, 59, 0, now.Location()),
			}
		}
	case "last_semester":
		if now.Month() >= 8 {
			return DateRange{
				Start: time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()),
				End:   time.Date(now.Year(), 7, 31, 23, 59, 59, 0, now.Location()),
			}
		} else {
			return DateRange{
				Start: time.Date(now.Year()-1, 8, 1, 0, 0, 0, 0, now.Location()),
				End:   time.Date(now.Year()-1, 12, 31, 23, 59, 59, 0, now.Location()),
			}
		}
	case "current_year":
		return DateRange{
			Start: time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()),
			End:   time.Date(now.Year(), 12, 31, 23, 59, 59, 0, now.Location()),
		}
	default: // last_30_days
		return DateRange{
			Start: now.AddDate(0, 0, -30),
			End:   now,
		}
	}
}

type DateRange struct {
	Start time.Time
	End   time.Time
}
