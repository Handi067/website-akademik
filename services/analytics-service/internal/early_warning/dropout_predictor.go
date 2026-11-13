package early_warning

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
	"gonum.org/v1/gonum/mat"
)

type DropoutPredictor struct {
	db         *sql.DB
	redis      *redis.Client
	logger     *logrus.Logger
	model      *DropoutModel
	threshold  float64
	featureSet []string
}

type DropoutModel struct {
	Weights     map[string]float64
	Intercept   float64
	Features    []string
	Accuracy    float64
	LastTrained time.Time
}

type DropoutRisk struct {
	StudentID       string       `json:"student_id"`
	RiskScore       float64      `json:"risk_score"`
	RiskLevel       string       `json:"risk_level"`
	RiskFactors     []string     `json:"risk_factors"`
	Predictions     []Prediction `json:"predictions"`
	Recommendations []string     `json:"recommendations"`
	LastUpdated     time.Time    `json:"last_updated"`
}

type Prediction struct {
	Date       time.Time `json:"date"`
	RiskScore  float64   `json:"risk_score"`
	RiskLevel  string    `json:"risk_level"`
	Confidence float64   `json:"confidence"`
}

type RiskFactor struct {
	Name         string  `json:"name"`
	Value        float64 `json:"value"`
	Weight       float64 `json:"weight"`
	Contribution float64 `json:"contribution"`
}

func NewDropoutPredictor(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *DropoutPredictor {
	return &DropoutPredictor{
		db:        db,
		redis:     redis,
		logger:    logger,
		threshold: 0.7,
		featureSet: []string{
			"gpa", "attendance_rate", "course_completion_rate",
			"assignment_completion_rate", "forum_participation",
			"login_frequency", "study_hours", "financial_status",
			"family_background", "academic_performance_trend",
		},
	}
}

func (dp *DropoutPredictor) PredictDropoutRisk(ctx context.Context, studentID string) (*DropoutRisk, error) {
	// Get student features
	features, err := dp.extractStudentFeatures(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to extract features: %w", err)
	}

	// Load or train model
	model, err := dp.loadModel(ctx)
	if err != nil {
		dp.logger.WithError(err).Warn("Failed to load model, using default")
		model = dp.getDefaultModel()
	}

	// Calculate risk score
	riskScore := dp.calculateRiskScore(features, model)

	// Determine risk level
	riskLevel := dp.determineRiskLevel(riskScore)

	// Identify risk factors
	riskFactors := dp.identifyRiskFactors(features, model)

	// Generate recommendations
	recommendations := dp.generateRecommendations(riskFactors, riskLevel)

	// Get historical predictions
	predictions, err := dp.getHistoricalPredictions(ctx, studentID)
	if err != nil {
		dp.logger.WithError(err).Warn("Failed to get historical predictions")
		predictions = []Prediction{}
	}

	dropoutRisk := &DropoutRisk{
		StudentID:       studentID,
		RiskScore:       riskScore,
		RiskLevel:       riskLevel,
		RiskFactors:     riskFactors,
		Predictions:     predictions,
		Recommendations: recommendations,
		LastUpdated:     time.Now(),
	}

	// Save prediction
	err = dp.savePrediction(ctx, dropoutRisk)
	if err != nil {
		dp.logger.WithError(err).Error("Failed to save prediction")
	}

	// Trigger alerts if high risk
	if riskScore >= dp.threshold {
		err = dp.triggerHighRiskAlert(ctx, dropoutRisk)
		if err != nil {
			dp.logger.WithError(err).Error("Failed to trigger high risk alert")
		}
	}

	return dropoutRisk, nil
}

func (dp *DropoutPredictor) extractStudentFeatures(ctx context.Context, studentID string) (map[string]float64, error) {
	features := make(map[string]float64)

	// Academic Performance
	gpa, err := dp.getStudentGPA(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get GPA: %w", err)
	}
	features["gpa"] = gpa

	// Attendance Rate
	attendanceRate, err := dp.getAttendanceRate(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get attendance rate: %w", err)
	}
	features["attendance_rate"] = attendanceRate

	// Course Completion Rate
	completionRate, err := dp.getCourseCompletionRate(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get course completion rate: %w", err)
	}
	features["course_completion_rate"] = completionRate

	// Assignment Completion Rate
	assignmentRate, err := dp.getAssignmentCompletionRate(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get assignment completion rate: %w", err)
	}
	features["assignment_completion_rate"] = assignmentRate

	// Forum Participation
	forumParticipation, err := dp.getForumParticipation(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get forum participation: %w", err)
	}
	features["forum_participation"] = forumParticipation

	// Login Frequency
	loginFreq, err := dp.getLoginFrequency(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get login frequency: %w", err)
	}
	features["login_frequency"] = loginFreq

	// Study Hours
	studyHours, err := dp.getStudyHours(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get study hours: %w", err)
	}
	features["study_hours"] = studyHours

	// Financial Status
	financialStatus, err := dp.getFinancialStatus(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get financial status: %w", err)
	}
	features["financial_status"] = financialStatus

	// Academic Performance Trend
	perfTrend, err := dp.getAcademicPerformanceTrend(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get performance trend: %w", err)
	}
	features["academic_performance_trend"] = perfTrend

	return features, nil
}

func (dp *DropoutPredictor) getStudentGPA(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT COALESCE(AVG(grade_points), 0.0) as gpa
		FROM student_grades sg
		JOIN courses c ON sg.course_id = c.id
		WHERE sg.student_id = $1
		AND sg.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
	`

	var gpa float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&gpa)
	if err != nil {
		return 0.0, err
	}

	return gpa, nil
}

func (dp *DropoutPredictor) getAttendanceRate(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT 
			COUNT(CASE WHEN status = 'present' THEN 1 END) * 100.0 / COUNT(*) as attendance_rate
		FROM attendance a
		JOIN course_sessions cs ON a.session_id = cs.id
		WHERE a.student_id = $1
		AND cs.session_date >= CURRENT_DATE - INTERVAL '90 days'
	`

	var attendanceRate float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&attendanceRate)
	if err != nil {
		return 0.0, err
	}

	return attendanceRate, nil
}

func (dp *DropoutPredictor) getCourseCompletionRate(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT 
			COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as completion_rate
		FROM student_courses sc
		WHERE sc.student_id = $1
		AND sc.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
	`

	var completionRate float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&completionRate)
	if err != nil {
		return 0.0, err
	}

	return completionRate, nil
}

func (dp *DropoutPredictor) getAssignmentCompletionRate(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT 
			COUNT(CASE WHEN sa.submitted_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as completion_rate
		FROM student_assignments sa
		JOIN assignments a ON sa.assignment_id = a.id
		WHERE sa.student_id = $1
		AND a.due_date >= CURRENT_DATE - INTERVAL '90 days'
	`

	var completionRate float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&completionRate)
	if err != nil {
		return 0.0, err
	}

	return completionRate, nil
}

func (dp *DropoutPredictor) getForumParticipation(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT COUNT(*) as participation_count
		FROM forum_posts fp
		WHERE fp.student_id = $1
		AND fp.created_at >= CURRENT_DATE - INTERVAL '90 days'
	`

	var count int
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&count)
	if err != nil {
		return 0.0, err
	}

	// Normalize to 0-1 scale
	return math.Min(float64(count)/30.0, 1.0), nil
}

func (dp *DropoutPredictor) getLoginFrequency(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT COUNT(DISTINCT DATE(login_time)) as login_days
		FROM user_activity_log
		WHERE user_id = $1
		AND login_time >= CURRENT_DATE - INTERVAL '30 days'
	`

	var loginDays int
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&loginDays)
	if err != nil {
		return 0.0, err
	}

	// Normalize to 0-1 scale (30 days in a month)
	return float64(loginDays) / 30.0, nil
}

func (dp *DropoutPredictor) getStudyHours(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT AVG(study_hours) as avg_study_hours
		FROM study_time_tracking
		WHERE student_id = $1
		AND tracking_date >= CURRENT_DATE - INTERVAL '30 days'
	`

	var avgStudyHours float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&avgStudyHours)
	if err != nil {
		return 0.0, err
	}

	// Normalize to 0-1 scale (assuming 8 hours max)
	return math.Min(avgStudyHours/8.0, 1.0), nil
}

func (dp *DropoutPredictor) getFinancialStatus(ctx context.Context, studentID string) (float64, error) {
	query := `
		SELECT 
			CASE 
				WHEN payment_status = 'current' THEN 1.0
				WHEN payment_status = 'overdue' THEN 0.5
				WHEN payment_status = 'delinquent' THEN 0.0
				ELSE 0.5
			END as financial_score
		FROM student_financial_status
		WHERE student_id = $1
		ORDER BY updated_at DESC
		LIMIT 1
	`

	var financialScore float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&financialScore)
	if err != nil {
		return 0.5, err // Default to neutral
	}

	return financialScore, nil
}

func (dp *DropoutPredictor) getAcademicPerformanceTrend(ctx context.Context, studentID string) (float64, error) {
	query := `
		WITH monthly_gpa AS (
			SELECT 
				EXTRACT(MONTH FROM created_at) as month,
				AVG(grade_points) as monthly_gpa
			FROM student_grades
			WHERE student_id = $1
			AND created_at >= CURRENT_DATE - INTERVAL '6 months'
			GROUP BY EXTRACT(MONTH FROM created_at)
			ORDER BY month
		)
		SELECT 
			COALESCE(
				(LAST_VALUE(monthly_gpa) OVER (ORDER BY month) - 
				 FIRST_VALUE(monthly_gpa) OVER (ORDER BY month)) / 
				NULLIF(FIRST_VALUE(monthly_gpa) OVER (ORDER BY month), 0), 0
			) as trend
		FROM monthly_gpa
		LIMIT 1
	`

	var trend float64
	err := dp.db.QueryRowContext(ctx, query, studentID).Scan(&trend)
	if err != nil {
		return 0.0, err
	}

	// Normalize to -1 to 1 scale
	return math.Max(-1.0, math.Min(1.0, trend)), nil
}

func (dp *DropoutPredictor) calculateRiskScore(features map[string]float64, model *DropoutModel) float64 {
	score := model.Intercept

	for feature, value := range features {
		if weight, exists := model.Weights[feature]; exists {
			score += weight * value
		}
	}

	// Apply sigmoid function to get probability
	return 1.0 / (1.0 + math.Exp(-score))
}

func (dp *DropoutPredictor) determineRiskLevel(riskScore float64) string {
	if riskScore >= 0.8 {
		return "critical"
	} else if riskScore >= 0.6 {
		return "high"
	} else if riskScore >= 0.4 {
		return "medium"
	} else if riskScore >= 0.2 {
		return "low"
	} else {
		return "very_low"
	}
}

func (dp *DropoutPredictor) identifyRiskFactors(features map[string]float64, model *DropoutModel) []string {
	riskFactors := []string{}

	for feature, value := range features {
		if weight, exists := model.Weights[feature]; exists {
			contribution := weight * value

			// Check if this feature contributes significantly to risk
			if contribution > 0.1 {
				riskFactors = append(riskFactors, dp.formatRiskFactor(feature, value, contribution))
			}
		}
	}

	return riskFactors
}

func (dp *DropoutPredictor) formatRiskFactor(feature string, value float64, contribution float64) string {
	switch feature {
	case "gpa":
		if value < 2.0 {
			return fmt.Sprintf("Low GPA (%.2f)", value)
		}
	case "attendance_rate":
		if value < 70.0 {
			return fmt.Sprintf("Poor attendance (%.1f%%)", value)
		}
	case "course_completion_rate":
		if value < 60.0 {
			return fmt.Sprintf("Low course completion (%.1f%%)", value)
		}
	case "assignment_completion_rate":
		if value < 70.0 {
			return fmt.Sprintf("Low assignment completion (%.1f%%)", value)
		}
	case "forum_participation":
		if value < 0.3 {
			return "Low forum participation"
		}
	case "login_frequency":
		if value < 0.5 {
			return "Infrequent system login"
		}
	case "study_hours":
		if value < 0.4 {
			return "Low study hours"
		}
	case "financial_status":
		if value < 0.5 {
			return "Financial difficulties"
		}
	case "academic_performance_trend":
		if value < -0.2 {
			return "Declining academic performance"
		}
	}

	return ""
}

func (dp *DropoutPredictor) generateRecommendations(riskFactors []string, riskLevel string) []string {
	recommendations := []string{}

	// Base recommendations by risk level
	switch riskLevel {
	case "critical":
		recommendations = append(recommendations,
			"Immediate academic counseling required",
			"Schedule meeting with academic advisor",
			"Consider temporary academic load reduction",
		)
	case "high":
		recommendations = append(recommendations,
			"Schedule academic counseling session",
			"Review study habits and time management",
			"Consider tutoring services",
		)
	case "medium":
		recommendations = append(recommendations,
			"Attend academic success workshop",
			"Join study groups",
			"Utilize academic resources",
		)
	}

	// Specific recommendations based on risk factors
	for _, factor := range riskFactors {
		if factor == "Low GPA" {
			recommendations = append(recommendations, "Focus on improving grades through tutoring")
		}
		if factor == "Poor attendance" {
			recommendations = append(recommendations, "Improve class attendance and participation")
		}
		if factor == "Financial difficulties" {
			recommendations = append(recommendations, "Contact financial aid office")
		}
		if factor == "Low forum participation" {
			recommendations = append(recommendations, "Engage more in online discussions")
		}
	}

	return recommendations
}

func (dp *DropoutPredictor) savePrediction(ctx context.Context, risk *DropoutRisk) error {
	// Save to database
	query := `
		INSERT INTO dropout_predictions (
			student_id, risk_score, risk_level, risk_factors,
			recommendations, prediction_date
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (student_id, prediction_date) 
		DO UPDATE SET 
			risk_score = EXCLUDED.risk_score,
			risk_level = EXCLUDED.risk_level,
			risk_factors = EXCLUDED.risk_factors,
			recommendations = EXCLUDED.recommendations
	`

	riskFactorsJSON, _ := json.Marshal(risk.RiskFactors)
	recommendationsJSON, _ := json.Marshal(risk.Recommendations)

	_, err := dp.db.ExecContext(ctx, query,
		risk.StudentID, risk.RiskScore, risk.RiskLevel,
		riskFactorsJSON, recommendationsJSON, risk.LastUpdated,
	)

	if err != nil {
		return err
	}

	// Cache in Redis for quick access
	riskJSON, _ := json.Marshal(risk)
	key := fmt.Sprintf("dropout_risk:%s", risk.StudentID)

	return dp.redis.Set(ctx, key, riskJSON, 24*time.Hour).Err()
}

func (dp *DropoutPredictor) getHistoricalPredictions(ctx context.Context, studentID string) ([]Prediction, error) {
	query := `
		SELECT prediction_date, risk_score, risk_level, confidence
		FROM dropout_predictions
		WHERE student_id = $1
		AND prediction_date >= CURRENT_DATE - INTERVAL '30 days'
		ORDER BY prediction_date DESC
		LIMIT 10
	`

	rows, err := dp.db.QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	predictions := []Prediction{}
	for rows.Next() {
		var p Prediction
		err := rows.Scan(&p.Date, &p.RiskScore, &p.RiskLevel, &p.Confidence)
		if err != nil {
			continue
		}
		predictions = append(predictions, p)
	}

	return predictions, nil
}

func (dp *DropoutPredictor) triggerHighRiskAlert(ctx context.Context, risk *DropoutRisk) error {
	alert := models.Alert{
		Type:      "dropout_risk",
		Severity:  "high",
		StudentID: risk.StudentID,
		Title:     "High Dropout Risk Detected",
		Message: fmt.Sprintf("Student %s has a dropout risk score of %.2f (%s)",
			risk.StudentID, risk.RiskScore, risk.RiskLevel),
		Data: map[string]interface{}{
			"risk_score":      risk.RiskScore,
			"risk_level":      risk.RiskLevel,
			"risk_factors":    risk.RiskFactors,
			"recommendations": risk.Recommendations,
		},
		CreatedAt: time.Now(),
	}

	// Save alert to database
	query := `
		INSERT INTO alerts (type, severity, student_id, title, message, data, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	dataJSON, _ := json.Marshal(alert.Data)
	_, err := dp.db.ExecContext(ctx, query,
		alert.Type, alert.Severity, alert.StudentID,
		alert.Title, alert.Message, dataJSON, alert.CreatedAt,
	)

	return err
}

func (dp *DropoutPredictor) loadModel(ctx context.Context) (*DropoutModel, error) {
	// Try to load from Redis first
	modelJSON, err := dp.redis.Get(ctx, "dropout_model").Result()
	if err == nil {
		var model DropoutModel
		err = json.Unmarshal([]byte(modelJSON), &model)
		if err == nil {
			return &model, nil
		}
	}

	// Load from database
	query := `
		SELECT model_data, accuracy, last_trained
		FROM ml_models
		WHERE model_type = 'dropout_prediction'
		ORDER BY last_trained DESC
		LIMIT 1
	`

	var modelDataJSON string
	var accuracy float64
	var lastTrained time.Time

	err = dp.db.QueryRowContext(ctx, query).Scan(&modelDataJSON, &accuracy, &lastTrained)
	if err != nil {
		return nil, err
	}

	var model DropoutModel
	err = json.Unmarshal([]byte(modelDataJSON), &model)
	if err != nil {
		return nil, err
	}

	model.Accuracy = accuracy
	model.LastTrained = lastTrained

	// Cache in Redis
	modelJSON, err := json.Marshal(model)
	if err != nil {
		dp.logger.WithError(err).Error("Failed to marshal model")
		return nil, err
	}
	dp.redis.Set(ctx, "dropout_model", string(modelJSON), 24*time.Hour)

	return &model, nil
}

func (dp *DropoutPredictor) getDefaultModel() *DropoutModel {
	return &DropoutModel{
		Weights: map[string]float64{
			"gpa":                        -2.5,
			"attendance_rate":            -1.8,
			"course_completion_rate":     -1.2,
			"assignment_completion_rate": -1.0,
			"forum_participation":        -0.5,
			"login_frequency":            -0.8,
			"study_hours":                -0.6,
			"financial_status":           -1.5,
			"academic_performance_trend": -2.0,
		},
		Intercept:   1.0,
		Features:    dp.featureSet,
		Accuracy:    0.75,
		LastTrained: time.Now().AddDate(0, -1, 0), // 1 month ago
	}
}

func (dp *DropoutPredictor) TrainModel(ctx context.Context) error {
	dp.logger.Info("Starting dropout prediction model training")

	// Get training data
	trainingData, err := dp.getTrainingData(ctx)
	if err != nil {
		return fmt.Errorf("failed to get training data: %w", err)
	}

	// Extract features and labels
	features, labels := dp.extractFeaturesAndLabels(trainingData)

	// Train logistic regression model
	model, err := dp.trainLogisticRegression(features, labels)
	if err != nil {
		return fmt.Errorf("failed to train model: %w", err)
	}

	// Evaluate model
	accuracy := dp.evaluateModel(model, features, labels)

	// Save model
	err = dp.saveModel(ctx, model, accuracy)
	if err != nil {
		return fmt.Errorf("failed to save model: %w", err)
	}

	dp.logger.WithField("accuracy", accuracy).Info("Model training completed")
	return nil
}

func (dp *DropoutPredictor) getTrainingData(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			s.id as student_id,
			COALESCE(AVG(sg.grade_points), 0.0) as gpa,
			COUNT(CASE WHEN a.status = 'present' THEN 1 END) * 100.0 / COUNT(*) as attendance_rate,
			COUNT(CASE WHEN sc.status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as course_completion_rate,
			COUNT(CASE WHEN sa.submitted_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as assignment_completion_rate,
			COUNT(fp.id) as forum_participation,
			COUNT(DISTINCT DATE(ual.login_time)) as login_frequency,
			AVG(stt.study_hours) as study_hours,
			CASE 
				WHEN sfs.payment_status = 'current' THEN 1.0
				WHEN sfs.payment_status = 'overdue' THEN 0.5
				WHEN sfs.payment_status = 'delinquent' THEN 0.0
				ELSE 0.5
			END as financial_status,
			CASE 
				WHEN s.status = 'dropped_out' THEN 1
				WHEN s.status = 'graduated' THEN 0
				WHEN s.status = 'active' THEN 0
				ELSE 0
			END as dropped_out
		FROM students s
		LEFT JOIN student_grades sg ON s.id = sg.student_id
		LEFT JOIN attendance a ON s.id = a.student_id
		LEFT JOIN course_sessions cs ON a.session_id = cs.id
		LEFT JOIN student_courses sc ON s.id = sc.student_id
		LEFT JOIN student_assignments sa ON s.id = sa.student_id
		LEFT JOIN assignments a2 ON sa.assignment_id = a2.id
		LEFT JOIN forum_posts fp ON s.id = fp.student_id
		LEFT JOIN user_activity_log ual ON s.id = ual.user_id
		LEFT JOIN study_time_tracking stt ON s.id = stt.student_id
		LEFT JOIN student_financial_status sfs ON s.id = sfs.student_id
		WHERE s.enrollment_date <= CURRENT_DATE - INTERVAL '6 months'
		GROUP BY s.id, s.status, sfs.payment_status
	`

	rows, err := dp.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trainingData []map[string]interface{}
	for rows.Next() {
		data := make(map[string]interface{})
		var studentID string
		var gpa, attendanceRate, courseCompletionRate, assignmentCompletionRate float64
		var forumParticipation, loginFrequency int
		var studyHours, financialStatus float64
		var droppedOut int

		err := rows.Scan(&studentID, &gpa, &attendanceRate, &courseCompletionRate,
			&assignmentCompletionRate, &forumParticipation, &loginFrequency,
			&studyHours, &financialStatus, &droppedOut)
		if err != nil {
			continue
		}

		data["student_id"] = studentID
		data["gpa"] = gpa
		data["attendance_rate"] = attendanceRate
		data["course_completion_rate"] = courseCompletionRate
		data["assignment_completion_rate"] = assignmentCompletionRate
		data["forum_participation"] = float64(forumParticipation)
		data["login_frequency"] = float64(loginFrequency)
		data["study_hours"] = studyHours
		data["financial_status"] = financialStatus
		data["dropped_out"] = droppedOut

		trainingData = append(trainingData, data)
	}

	return trainingData, nil
}

func (dp *DropoutPredictor) extractFeaturesAndLabels(trainingData []map[string]interface{}) ([][]float64, []float64) {
	features := make([][]float64, len(trainingData))
	labels := make([]float64, len(trainingData))

	for i, data := range trainingData {
		features[i] = []float64{
			data["gpa"].(float64),
			data["attendance_rate"].(float64),
			data["course_completion_rate"].(float64),
			data["assignment_completion_rate"].(float64),
			data["forum_participation"].(float64),
			data["login_frequency"].(float64),
			data["study_hours"].(float64),
			data["financial_status"].(float64),
		}
		labels[i] = float64(data["dropped_out"].(int))
	}

	return features, labels
}

func (dp *DropoutPredictor) trainLogisticRegression(features [][]float64, labels []float64) (*DropoutModel, error) {
	// Convert to gonum matrices
	x := mat.NewDense(len(features), len(features[0]), nil)
	for i, feature := range features {
		x.SetRow(i, feature)
	}

	// Simple logistic regression using gradient descent
	weights := make([]float64, len(features[0]))
	intercept := 0.0
	learningRate := 0.01
	epochs := 1000

	for epoch := 0; epoch < epochs; epoch++ {
		// Calculate predictions
		predictions := make([]float64, len(labels))
		for i := range labels {
			score := intercept
			for j, weight := range weights {
				score += weight * features[i][j]
			}
			predictions[i] = 1.0 / (1.0 + math.Exp(-score))
		}

		// Calculate gradients
		weightGradients := make([]float64, len(weights))
		interceptGradient := 0.0

		for i := range labels {
			error := predictions[i] - labels[i]
			interceptGradient += error
			for j := range weights {
				weightGradients[j] += error * features[i][j]
			}
		}

		// Update weights
		intercept -= learningRate * interceptGradient / float64(len(labels))
		for j := range weights {
			weights[j] -= learningRate * weightGradients[j] / float64(len(labels))
		}
	}

	// Create model
	model := &DropoutModel{
		Weights:   make(map[string]float64),
		Intercept: intercept,
		Features:  dp.featureSet,
	}

	featureNames := []string{
		"gpa", "attendance_rate", "course_completion_rate",
		"assignment_completion_rate", "forum_participation",
		"login_frequency", "study_hours", "financial_status",
	}

	for i, name := range featureNames {
		model.Weights[name] = weights[i]
	}

	return model, nil
}

func (dp *DropoutPredictor) evaluateModel(model *DropoutModel, features [][]float64, labels []float64) float64 {
	correct := 0

	for i, feature := range features {
		score := model.Intercept
		for j, value := range feature {
			featureName := []string{
				"gpa", "attendance_rate", "course_completion_rate",
				"assignment_completion_rate", "forum_participation",
				"login_frequency", "study_hours", "financial_status",
			}[j]

			if weight, exists := model.Weights[featureName]; exists {
				score += weight * value
			}
		}

		prediction := 1.0 / (1.0 + math.Exp(-score))
		predicted := 0
		if prediction >= 0.5 {
			predicted = 1
		}

		if predicted == int(labels[i]) {
			correct++
		}
	}

	return float64(correct) / float64(len(labels))
}

func (dp *DropoutPredictor) saveModel(ctx context.Context, model *DropoutModel, accuracy float64) error {
	modelJSON, _ := json.Marshal(model)

	query := `
		INSERT INTO ml_models (model_type, model_data, accuracy, last_trained)
		VALUES ('dropout_prediction', $1, $2, $3)
		ON CONFLICT (model_type) 
		DO UPDATE SET 
			model_data = EXCLUDED.model_data,
			accuracy = EXCLUDED.accuracy,
			last_trained = EXCLUDED.last_trained
	`

	_, err := dp.db.ExecContext(ctx, query, string(modelJSON), accuracy, time.Now())
	if err != nil {
		return err
	}

	// Cache in Redis
	return dp.redis.Set(ctx, "dropout_model", modelJSON, 24*time.Hour).Err()
}
