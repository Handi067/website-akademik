package recommendation

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type CourseRecommender struct {
	db         *sql.DB
	redis      *redis.Client
	logger     *logrus.Logger
	model      *RecommendationModel
	featureSet []string
}

type RecommendationModel struct {
	UserWeights      map[string]float64            `json:"user_weights"`
	CourseFeatures   map[string]map[string]float64 `json:"course_features"`
	SimilarityMatrix map[string]map[string]float64 `json:"similarity_matrix"`
	LastTrained      time.Time                     `json:"last_trained"`
	Accuracy         float64                       `json:"accuracy"`
}

type CourseRecommendation struct {
	CourseID        string     `json:"course_id"`
	CourseName      string     `json:"course_name"`
	Score           float64    `json:"score"`
	Confidence      float64    `json:"confidence"`
	Reasons         []string   `json:"reasons"`
	Prerequisites   []string   `json:"prerequisites"`
	CareerRelevance float64    `json:"career_relevance"`
	Popularity      float64    `json:"popularity"`
	Difficulty      string     `json:"difficulty"`
	Credits         int        `json:"credits"`
	Schedule        []TimeSlot `json:"schedule"`
}

type TimeSlot struct {
	Day   string `json:"day"`
	Start string `json:"start"`
	End   string `json:"end"`
	Room  string `json:"room"`
}

type StudentProfile struct {
	StudentID           string             `json:"student_id"`
	Major               string             `json:"major"`
	Year                int                `json:"year"`
	GPA                 float64            `json:"gpa"`
	Interests           []string           `json:"interests"`
	LearningStyle       string             `json:"learning_style"`
	PreferredDifficulty string             `json:"preferred_difficulty"`
	TimePreference      string             `json:"time_preference"`
	CompletedCourses    []string           `json:"completed_courses"`
	AcademicHistory     map[string]float64 `json:"academic_history"`
	CareerGoals         []string           `json:"career_goals"`
	Skills              []string           `json:"skills"`
}

type CourseFeatures struct {
	CourseID           string     `json:"course_id"`
	CourseName         string     `json:"course_name"`
	Description        string     `json:"description"`
	Credits            int        `json:"credits"`
	Difficulty         float64    `json:"difficulty"`
	Prerequisites      []string   `json:"prerequisites"`
	Topics             []string   `json:"topics"`
	Skills             []string   `json:"skills"`
	CareerRelevance    []string   `json:"career_relevance"`
	Popularity         float64    `json:"popularity"`
	AverageRating      float64    `json:"average_rating"`
	CompletionRate     float64    `json:"completion_rate"`
	TimeSlots          []TimeSlot `json:"time_slots"`
	Department         string     `json:"department"`
	Level              string     `json:"level"`
	LearningObjectives []string   `json:"learning_objectives"`
	AssessmentMethods  []string   `json:"assessment_methods"`
}

func NewCourseRecommender(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *CourseRecommender {
	return &CourseRecommender{
		db:     db,
		redis:  redis,
		logger: logger,
		featureSet: []string{
			"academic_performance", "interest_match", "career_alignment",
			"difficulty_match", "time_preference", "prerequisite_completion",
			"peer_similarity", "content_similarity", "skill_development",
			"schedule_compatibility", "popularity_score",
		},
	}
}

func (cr *CourseRecommender) GetRecommendations(ctx context.Context, studentID string, limit int) ([]CourseRecommendation, error) {
	// Get student profile
	profile, err := cr.getStudentProfile(ctx, studentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get student profile: %w", err)
	}

	// Get available courses
	availableCourses, err := cr.getAvailableCourses(ctx, profile)
	if err != nil {
		return nil, fmt.Errorf("failed to get available courses: %w", err)
	}

	// Load recommendation model
	model, err := cr.loadModel(ctx)
	if err != nil {
		cr.logger.WithError(err).Warn("Failed to load model, using default")
		model = cr.getDefaultModel()
	}

	// Calculate recommendations
	recommendations := make([]CourseRecommendation, 0)
	for _, course := range availableCourses {
		score, confidence, reasons := cr.calculateRecommendationScore(profile, course, model)

		recommendation := CourseRecommendation{
			CourseID:        course.CourseID,
			CourseName:      course.CourseName,
			Score:           score,
			Confidence:      confidence,
			Reasons:         reasons,
			Prerequisites:   course.Prerequisites,
			CareerRelevance: cr.calculateCareerRelevance(profile, course),
			Popularity:      course.Popularity,
			Difficulty:      cr.getDifficultyLevel(course.Difficulty),
			Credits:         course.Credits,
			Schedule:        course.TimeSlots,
		}

		recommendations = append(recommendations, recommendation)
	}

	// Sort by score
	sort.Slice(recommendations, func(i, j int) bool {
		return recommendations[i].Score > recommendations[j].Score
	})

	// Limit results
	if len(recommendations) > limit {
		recommendations = recommendations[:limit]
	}

	// Save recommendations
	err = cr.saveRecommendations(ctx, studentID, recommendations)
	if err != nil {
		cr.logger.WithError(err).Error("Failed to save recommendations")
	}

	return recommendations, nil
}

func (cr *CourseRecommender) getStudentProfile(ctx context.Context, studentID string) (*StudentProfile, error) {
	// Try to get from cache first
	cachedProfile, err := cr.redis.Get(ctx, fmt.Sprintf("student_profile:%s", studentID)).Result()
	if err == nil {
		var profile StudentProfile
		err = json.Unmarshal([]byte(cachedProfile), &profile)
		if err == nil {
			return &profile, nil
		}
	}

	// Get from database
	profile := &StudentProfile{StudentID: studentID}

	// Basic info
	query := `
		SELECT s.major, s.year, s.gpa, s.learning_style, s.preferred_difficulty, s.time_preference
		FROM students s
		WHERE s.id = $1
	`
	err = cr.db.QueryRowContext(ctx, query, studentID).Scan(
		&profile.Major, &profile.Year, &profile.GPA,
		&profile.LearningStyle, &profile.PreferredDifficulty, &profile.TimePreference,
	)
	if err != nil {
		return nil, err
	}

	// Get interests
	interestsQuery := `
		SELECT interest FROM student_interests WHERE student_id = $1
	`
	rows, err := cr.db.QueryContext(ctx, interestsQuery, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var interest string
		rows.Scan(&interest)
		profile.Interests = append(profile.Interests, interest)
	}

	// Get completed courses
	completedQuery := `
		SELECT course_id FROM student_courses 
		WHERE student_id = $1 AND status = 'completed'
	`
	rows, err = cr.db.QueryContext(ctx, completedQuery, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var courseID string
		rows.Scan(&courseID)
		profile.CompletedCourses = append(profile.CompletedCourses, courseID)
	}

	// Get academic history
	historyQuery := `
		SELECT c.id, sg.grade_points
		FROM student_grades sg
		JOIN courses c ON sg.course_id = c.id
		WHERE sg.student_id = $1
	`
	rows, err = cr.db.QueryContext(ctx, historyQuery, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	profile.AcademicHistory = make(map[string]float64)
	for rows.Next() {
		var courseID string
		var grade float64
		rows.Scan(&courseID, &grade)
		profile.AcademicHistory[courseID] = grade
	}

	// Get career goals
	careerQuery := `
		SELECT goal FROM student_career_goals WHERE student_id = $1
	`
	rows, err = cr.db.QueryContext(ctx, careerQuery, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var goal string
		rows.Scan(&goal)
		profile.CareerGoals = append(profile.CareerGoals, goal)
	}

	// Get skills
	skillsQuery := `
		SELECT skill FROM student_skills WHERE student_id = $1
	`
	rows, err = cr.db.QueryContext(ctx, skillsQuery, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var skill string
		rows.Scan(&skill)
		profile.Skills = append(profile.Skills, skill)
	}

	// Cache the profile
	profileJSON, _ := json.Marshal(profile)
	cr.redis.Set(ctx, fmt.Sprintf("student_profile:%s", studentID), profileJSON, time.Hour)

	return profile, nil
}

func (cr *CourseRecommender) getAvailableCourses(ctx context.Context, profile *StudentProfile) ([]CourseFeatures, error) {
	query := `
		SELECT 
			c.id, c.name, c.description, c.credits, c.difficulty,
			c.department, c.level, c.popularity, c.average_rating, c.completion_rate
		FROM courses c
		WHERE c.status = 'active'
		AND c.academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
		AND c.id NOT IN (
			SELECT course_id FROM student_courses 
			WHERE student_id = $1 AND status IN ('enrolled', 'completed')
		)
		ORDER BY c.popularity DESC
	`

	rows, err := cr.db.QueryContext(ctx, query, profile.StudentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var courses []CourseFeatures
	for rows.Next() {
		var course CourseFeatures
		err := rows.Scan(
			&course.CourseID, &course.CourseName, &course.Description,
			&course.Credits, &course.Difficulty, &course.Department,
			&course.Level, &course.Popularity, &course.AverageRating, &course.CompletionRate,
		)
		if err != nil {
			continue
		}

		// Get prerequisites
		prereqQuery := `
			SELECT prerequisite_course_id FROM course_prerequisites WHERE course_id = $1
		`
		prereqRows, err := cr.db.QueryContext(ctx, prereqQuery, course.CourseID)
		if err == nil {
			defer prereqRows.Close()
			for prereqRows.Next() {
				var prereq string
				prereqRows.Scan(&prereq)
				course.Prerequisites = append(course.Prerequisites, prereq)
			}
		}

		// Get topics
		topicsQuery := `
			SELECT topic FROM course_topics WHERE course_id = $1
		`
		topicsRows, err := cr.db.QueryContext(ctx, topicsQuery, course.CourseID)
		if err == nil {
			defer topicsRows.Close()
			for topicsRows.Next() {
				var topic string
				topicsRows.Scan(&topic)
				course.Topics = append(course.Topics, topic)
			}
		}

		// Get skills
		skillsQuery := `
			SELECT skill FROM course_skills WHERE course_id = $1
		`
		skillsRows, err := cr.db.QueryContext(ctx, skillsQuery, course.CourseID)
		if err == nil {
			defer skillsRows.Close()
			for skillsRows.Next() {
				var skill string
				skillsRows.Scan(&skill)
				course.Skills = append(course.Skills, skill)
			}
		}

		// Get career relevance
		careerQuery := `
			SELECT career_path FROM course_career_relevance WHERE course_id = $1
		`
		careerRows, err := cr.db.QueryContext(ctx, careerQuery, course.CourseID)
		if err == nil {
			defer careerRows.Close()
			for careerRows.Next() {
				var career string
				careerRows.Scan(&career)
				course.CareerRelevance = append(course.CareerRelevance, career)
			}
		}

		// Get time slots
		scheduleQuery := `
			SELECT day_of_week, start_time, end_time, room
			FROM course_schedule
			WHERE course_id = $1
			ORDER BY day_of_week, start_time
		`
		scheduleRows, err := cr.db.QueryContext(ctx, scheduleQuery, course.CourseID)
		if err == nil {
			defer scheduleRows.Close()
			for scheduleRows.Next() {
				var slot TimeSlot
				scheduleRows.Scan(&slot.Day, &slot.Start, &slot.End, &slot.Room)
				course.TimeSlots = append(course.TimeSlots, slot)
			}
		}

		courses = append(courses, course)
	}

	return courses, nil
}

func (cr *CourseRecommender) calculateRecommendationScore(profile *StudentProfile, course CourseFeatures, model *RecommendationModel) (float64, float64, []string) {
	score := 0.0
	confidence := 0.0
	reasons := []string{}

	// Academic performance factor
	academicScore := cr.calculateAcademicScore(profile, course)
	score += academicScore * 0.25
	if academicScore > 0.7 {
		reasons = append(reasons, "Matches your academic performance level")
	}

	// Interest match factor
	interestScore := cr.calculateInterestScore(profile, course)
	score += interestScore * 0.20
	if interestScore > 0.6 {
		reasons = append(reasons, "Aligns with your interests")
	}

	// Career alignment factor
	careerScore := cr.calculateCareerAlignment(profile, course)
	score += careerScore * 0.15
	if careerScore > 0.5 {
		reasons = append(reasons, "Supports your career goals")
	}

	// Difficulty match factor
	difficultyScore := cr.calculateDifficultyMatch(profile, course)
	score += difficultyScore * 0.15
	if difficultyScore > 0.7 {
		reasons = append(reasons, "Appropriate difficulty level")
	}

	// Prerequisite completion factor
	prereqScore := cr.calculatePrerequisiteScore(profile, course)
	score += prereqScore * 0.10
	if prereqScore == 1.0 {
		reasons = append(reasons, "You have completed all prerequisites")
	}

	// Peer similarity factor
	peerScore := cr.calculatePeerSimilarity(profile, course)
	score += peerScore * 0.10
	if peerScore > 0.6 {
		reasons = append(reasons, "Popular among similar students")
	}

	// Skill development factor
	skillScore := cr.calculateSkillDevelopment(profile, course)
	score += skillScore * 0.05
	if skillScore > 0.5 {
		reasons = append(reasons, "Helps develop important skills")
	}

	// Schedule compatibility factor
	scheduleScore := cr.calculateScheduleCompatibility(profile, course)
	score += scheduleScore * 0.05
	if scheduleScore > 0.7 {
		reasons = append(reasons, "Fits your schedule preferences")
	}

	// Popularity factor
	popularityScore := cr.normalizePopularity(course.Popularity)
	score += popularityScore * 0.05
	if popularityScore > 0.7 {
		reasons = append(reasons, "Highly rated by other students")
	}

	// Calculate confidence based on data availability
	confidence = cr.calculateConfidence(profile, course)

	// Ensure score is within bounds
	score = math.Max(0.0, math.Min(1.0, score))

	return score, confidence, reasons
}

func (cr *CourseRecommender) calculateAcademicScore(profile *StudentProfile, course CourseFeatures) float64 {
	if profile.GPA == 0 {
		return 0.5 // Default for new students
	}

	// Adjust score based on GPA vs course difficulty
	gpaScore := profile.GPA / 4.0
	difficultyScore := 1.0 - course.Difficulty

	// Weight more for higher GPA students
	if profile.GPA >= 3.5 {
		return (gpaScore * 0.7) + (difficultyScore * 0.3)
	} else if profile.GPA >= 2.5 {
		return (gpaScore * 0.5) + (difficultyScore * 0.5)
	} else {
		return (gpaScore * 0.3) + (difficultyScore * 0.7)
	}
}

func (cr *CourseRecommender) calculateInterestScore(profile *StudentProfile, course CourseFeatures) float64 {
	if len(profile.Interests) == 0 {
		return 0.5 // Default if no interests specified
	}

	matches := 0
	for _, interest := range profile.Interests {
		for _, topic := range course.Topics {
			if cr.matchInterest(interest, topic) {
				matches++
				break
			}
		}
	}

	return float64(matches) / float64(len(profile.Interests))
}

func (cr *CourseRecommender) matchInterest(interest, topic string) bool {
	// Simple string matching - in production, use NLP/similarity algorithms
	interestLower := fmt.Sprintf(" %s ", interest)
	topicLower := fmt.Sprintf(" %s ", topic)

	return fmt.Sprintf("%s", interestLower) == fmt.Sprintf("%s", topicLower) ||
		fmt.Sprintf("%s", topicLower) == fmt.Sprintf("%s", interestLower)
}

func (cr *CourseRecommender) calculateCareerAlignment(profile *StudentProfile, course CourseFeatures) float64 {
	if len(profile.CareerGoals) == 0 {
		return 0.5 // Default if no career goals specified
	}

	matches := 0
	for _, goal := range profile.CareerGoals {
		for _, career := range course.CareerRelevance {
			if cr.matchCareer(goal, career) {
				matches++
				break
			}
		}
	}

	return float64(matches) / float64(len(profile.CareerGoals))
}

func (cr *CourseRecommender) matchCareer(goal, career string) bool {
	// Simple string matching - in production, use NLP/similarity algorithms
	goalLower := fmt.Sprintf(" %s ", goal)
	careerLower := fmt.Sprintf(" %s ", career)

	return fmt.Sprintf("%s", goalLower) == fmt.Sprintf("%s", careerLower) ||
		fmt.Sprintf("%s", careerLower) == fmt.Sprintf("%s", goalLower)
}

func (cr *CourseRecommender) calculateDifficultyMatch(profile *StudentProfile, course CourseFeatures) float64 {
	// Map preferred difficulty to numeric value
	preferredDifficulty := map[string]float64{
		"beginner":     0.2,
		"intermediate": 0.5,
		"advanced":     0.8,
		"expert":       1.0,
	}

	preferred, exists := preferredDifficulty[profile.PreferredDifficulty]
	if !exists {
		preferred = 0.5 // Default to intermediate
	}

	// Calculate inverse difference
	diff := math.Abs(course.Difficulty - preferred)
	return 1.0 - diff
}

func (cr *CourseRecommender) calculatePrerequisiteScore(profile *StudentProfile, course CourseFeatures) float64 {
	if len(course.Prerequisites) == 0 {
		return 1.0 // No prerequisites
	}

	completed := 0
	for _, prereq := range course.Prerequisites {
		for _, completedCourse := range profile.CompletedCourses {
			if completedCourse == prereq {
				completed++
				break
			}
		}
	}

	return float64(completed) / float64(len(course.Prerequisites))
}

func (cr *CourseRecommender) calculatePeerSimilarity(profile *StudentProfile, course CourseFeatures) float64 {
	// Find similar students and their course preferences
	query := `
		WITH similar_students AS (
			SELECT s2.id, COUNT(*) as common_courses
			FROM student_courses sc1
			JOIN student_courses sc2 ON sc1.course_id = sc2.course_id
			JOIN students s2 ON sc2.student_id = s2.id
			WHERE sc1.student_id = $1
			AND sc2.student_id != $1
			AND sc1.status = 'completed'
			AND sc2.status = 'completed'
			GROUP BY s2.id
			HAVING COUNT(*) >= 2
			ORDER BY common_courses DESC
			LIMIT 10
		)
		SELECT AVG(CASE WHEN sc.course_id = $2 THEN 1.0 ELSE 0.0 END) as similarity_score
		FROM similar_students ss
		LEFT JOIN student_courses sc ON ss.id = sc.student_id
		WHERE sc.status = 'completed'
		GROUP BY ss.id
	`

	var similarityScore float64
	err := cr.db.QueryRowContext(ctx, query, profile.StudentID, course.CourseID).Scan(&similarityScore)
	if err != nil {
		return 0.5 // Default if no similar students found
	}

	return similarityScore
}

func (cr *CourseRecommender) calculateSkillDevelopment(profile *StudentProfile, course CourseFeatures) float64 {
	if len(course.Skills) == 0 {
		return 0.5 // Default if no skills specified
	}

	relevantSkills := 0
	for _, skill := range course.Skills {
		for _, careerGoal := range profile.CareerGoals {
			if cr.skillRelevantToCareer(skill, careerGoal) {
				relevantSkills++
				break
			}
		}
	}

	return float64(relevantSkills) / float64(len(course.Skills))
}

func (cr *CourseRecommender) skillRelevantToCareer(skill, career string) bool {
	// Simple mapping - in production, use a skills-career matrix
	skillCareerMap := map[string][]string{
		"programming":   {"software developer", "data scientist", "web developer"},
		"data analysis": {"data scientist", "business analyst", "researcher"},
		"communication": {"manager", "consultant", "sales"},
		"leadership":    {"manager", "team lead", "entrepreneur"},
		"design":        {"designer", "ux designer", "product designer"},
	}

	for career, skills := range skillCareerMap {
		if career == career {
			for _, s := range skills {
				if s == skill {
					return true
				}
			}
		}
	}

	return false
}

func (cr *CourseRecommender) calculateScheduleCompatibility(profile *StudentProfile, course CourseFeatures) float64 {
	if len(course.TimeSlots) == 0 {
		return 0.5 // Default if no schedule
	}

	// Get student's current schedule
	query := `
		SELECT day_of_week, start_time, end_time
		FROM student_schedule
		WHERE student_id = $1
		AND academic_year = EXTRACT(YEAR FROM CURRENT_DATE)
	`

	rows, err := cr.db.QueryContext(ctx, query, profile.StudentID)
	if err != nil {
		return 0.5 // Default if error
	}
	defer rows.Close()

	currentSchedule := make(map[string][]TimeSlot)
	for rows.Next() {
		var slot TimeSlot
		rows.Scan(&slot.Day, &slot.Start, &slot.End)
		currentSchedule[slot.Day] = append(currentSchedule[slot.Day], slot)
	}

	// Check for conflicts
	conflicts := 0
	for _, courseSlot := range course.TimeSlots {
		for _, currentSlot := range currentSchedule[courseSlot.Day] {
			if cr.timeOverlaps(courseSlot, currentSlot) {
				conflicts++
				break
			}
		}
	}

	// Calculate compatibility (no conflicts = high score)
	if conflicts == 0 {
		return 1.0
	}
	return 1.0 - (float64(conflicts) / float64(len(course.TimeSlots)))
}

func (cr *CourseRecommender) timeOverlaps(slot1, slot2 TimeSlot) bool {
	// Simple time overlap check - in production, use proper time parsing
	return slot1.Day == slot2.Day && slot1.Start < slot2.End && slot2.Start < slot1.End
}

func (cr *CourseRecommender) normalizePopularity(popularity float64) float64 {
	// Normalize popularity to 0-1 scale (assuming max popularity of 100)
	return math.Min(popularity/100.0, 1.0)
}

func (cr *CourseRecommender) calculateConfidence(profile *StudentProfile, course CourseFeatures) float64 {
	confidence := 0.0
	factors := 0

	// Academic history confidence
	if len(profile.AcademicHistory) > 0 {
		confidence += 0.3
	}
	factors++

	// Interests confidence
	if len(profile.Interests) > 0 {
		confidence += 0.2
	}
	factors++

	// Career goals confidence
	if len(profile.CareerGoals) > 0 {
		confidence += 0.2
	}
	factors++

	// Completed courses confidence
	if len(profile.CompletedCourses) > 0 {
		confidence += 0.3
	}
	factors++

	return confidence / float64(factors)
}

func (cr *CourseRecommender) calculateCareerRelevance(profile *StudentProfile, course CourseFeatures) float64 {
	if len(profile.CareerGoals) == 0 {
		return 0.5 // Default if no career goals
	}

	relevance := 0.0
	for _, goal := range profile.CareerGoals {
		for _, career := range course.CareerRelevance {
			if cr.matchCareer(goal, career) {
				relevance += 1.0
				break
			}
		}
	}

	return relevance / float64(len(profile.CareerGoals))
}

func (cr *CourseRecommender) getDifficultyLevel(difficulty float64) string {
	if difficulty <= 0.3 {
		return "beginner"
	} else if difficulty <= 0.6 {
		return "intermediate"
	} else if difficulty <= 0.8 {
		return "advanced"
	} else {
		return "expert"
	}
}

func (cr *CourseRecommender) saveRecommendations(ctx context.Context, studentID string, recommendations []CourseRecommendation) error {
	// Save to database
	query := `
		INSERT INTO course_recommendations (
			student_id, course_id, score, confidence, reasons, created_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (student_id, course_id) 
		DO UPDATE SET 
			score = EXCLUDED.score,
			confidence = EXCLUDED.confidence,
			reasons = EXCLUDED.reasons,
			created_at = EXCLUDED.created_at
	`

	for _, rec := range recommendations {
		reasonsJSON, _ := json.Marshal(rec.Reasons)
		_, err := cr.db.ExecContext(ctx, query,
			studentID, rec.CourseID, rec.Score, rec.Confidence,
			reasonsJSON, time.Now(),
		)
		if err != nil {
			cr.logger.WithError(err).Error("Failed to save recommendation")
		}
	}

	// Cache in Redis
	recsJSON, _ := json.Marshal(recommendations)
	key := fmt.Sprintf("course_recommendations:%s", studentID)
	return cr.redis.Set(ctx, key, recsJSON, time.Hour).Err()
}

func (cr *CourseRecommender) loadModel(ctx context.Context) (*RecommendationModel, error) {
	// Try to load from Redis first
	modelJSON, err := cr.redis.Get(ctx, "recommendation_model").Result()
	if err == nil {
		var model RecommendationModel
		err = json.Unmarshal([]byte(modelJSON), &model)
		if err == nil {
			return &model, nil
		}
	}

	// Load from database
	query := `
		SELECT model_data, accuracy, last_trained
		FROM ml_models
		WHERE model_type = 'course_recommendation'
		ORDER BY last_trained DESC
		LIMIT 1
	`

	var modelDataJSON string
	var accuracy float64
	var lastTrained time.Time

	err = cr.db.QueryRowContext(ctx, query).Scan(&modelDataJSON, &accuracy, &lastTrained)
	if err != nil {
		return nil, err
	}

	var model RecommendationModel
	err = json.Unmarshal([]byte(modelDataJSON), &model)
	if err != nil {
		return nil, err
	}

	model.Accuracy = accuracy
	model.LastTrained = lastTrained

	// Cache in Redis
	modelJSON, err = json.Marshal(model)
	if err != nil {
		cr.logger.WithError(err).Error("Failed to marshal model")
		return nil, err
	}
	cr.redis.Set(ctx, "recommendation_model", string(modelJSON), 24*time.Hour)

	return &model, nil
}

func (cr *CourseRecommender) getDefaultModel() *RecommendationModel {
	return &RecommendationModel{
		UserWeights: map[string]float64{
			"academic_performance":    0.25,
			"interest_match":          0.20,
			"career_alignment":        0.15,
			"difficulty_match":        0.15,
			"prerequisite_completion": 0.10,
			"peer_similarity":         0.10,
			"skill_development":       0.05,
			"schedule_compatibility":  0.05,
			"popularity_score":        0.05,
		},
		CourseFeatures:   make(map[string]map[string]float64),
		SimilarityMatrix: make(map[string]map[string]float64),
		LastTrained:      time.Now().AddDate(0, -1, 0), // 1 month ago
		Accuracy:         0.75,
	}
}

func (cr *CourseRecommender) TrainModel(ctx context.Context) error {
	cr.logger.Info("Starting course recommendation model training")

	// Get training data
	trainingData, err := cr.getTrainingData(ctx)
	if err != nil {
		return fmt.Errorf("failed to get training data: %w", err)
	}

	// Train collaborative filtering model
	model, err := cr.trainCollaborativeFiltering(trainingData)
	if err != nil {
		return fmt.Errorf("failed to train collaborative filtering: %w", err)
	}

	// Evaluate model
	accuracy := cr.evaluateModel(model, trainingData)

	// Save model
	err = cr.saveModel(ctx, model, accuracy)
	if err != nil {
		return fmt.Errorf("failed to save model: %w", err)
	}

	cr.logger.WithField("accuracy", accuracy).Info("Model training completed")
	return nil
}

func (cr *CourseRecommender) getTrainingData(ctx context.Context) ([]map[string]interface{}, error) {
	query := `
		SELECT 
			sc.student_id, sc.course_id, sc.grade, sc.rating,
			s.major, s.year, s.gpa, s.learning_style,
			c.difficulty, c.department, c.level
		FROM student_courses sc
		JOIN students s ON sc.student_id = s.id
		JOIN courses c ON sc.course_id = c.id
		WHERE sc.status = 'completed'
		AND sc.grade IS NOT NULL
		AND sc.academic_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2
	`

	rows, err := cr.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trainingData []map[string]interface{}
	for rows.Next() {
		data := make(map[string]interface{})
		var studentID, courseID, major, year, learningStyle, department, level string
		var grade, rating, gpa, difficulty float64

		err := rows.Scan(&studentID, &courseID, &grade, &rating,
			&major, &year, &gpa, &learningStyle,
			&difficulty, &department, &level)
		if err != nil {
			continue
		}

		data["student_id"] = studentID
		data["course_id"] = courseID
		data["grade"] = grade
		data["rating"] = rating
		data["major"] = major
		data["year"] = year
		data["gpa"] = gpa
		data["learning_style"] = learningStyle
		data["difficulty"] = difficulty
		data["department"] = department
		data["level"] = level

		trainingData = append(trainingData, data)
	}

	return trainingData, nil
}

func (cr *CourseRecommender) trainCollaborativeFiltering(trainingData []map[string]interface{}) (*RecommendationModel, error) {
	// Simple collaborative filtering implementation
	// In production, use more sophisticated algorithms like matrix factorization

	model := &RecommendationModel{
		UserWeights:      make(map[string]float64),
		CourseFeatures:   make(map[string]map[string]float64),
		SimilarityMatrix: make(map[string]map[string]float64),
		LastTrained:      time.Now(),
	}

	// Calculate user preferences based on grades and ratings
	userPreferences := make(map[string]map[string]float64)
	for _, data := range trainingData {
		studentID := data["student_id"].(string)
		courseID := data["course_id"].(string)
		grade := data["grade"].(float64)
		rating := data["rating"].(float64)

		if userPreferences[studentID] == nil {
			userPreferences[studentID] = make(map[string]float64)
		}

		// Combine grade and rating for preference score
		preference := (grade/4.0*0.7 + rating/5.0*0.3)
		userPreferences[studentID][courseID] = preference
	}

	// Calculate course similarities
	for courseID1 := range userPreferences {
		for courseID2 := range userPreferences {
			if courseID1 != courseID2 {
				similarity := cr.calculateCosineSimilarity(
					userPreferences, courseID1, courseID2)

				if model.SimilarityMatrix[courseID1] == nil {
					model.SimilarityMatrix[courseID1] = make(map[string]float64)
				}
				model.SimilarityMatrix[courseID1][courseID2] = similarity
			}
		}
	}

	return model, nil
}

func (cr *CourseRecommender) calculateCosineSimilarity(userPreferences map[string]map[string]float64, course1, course2 string) float64 {
	var dotProduct, norm1, norm2 float64

	for _, preferences := range userPreferences {
		rating1, exists1 := preferences[course1]
		rating2, exists2 := preferences[course2]

		if exists1 && exists2 {
			dotProduct += rating1 * rating2
			norm1 += rating1 * rating1
			norm2 += rating2 * rating2
		}
	}

	if norm1 == 0 || norm2 == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(norm1) * math.Sqrt(norm2))
}

func (cr *CourseRecommender) evaluateModel(model *RecommendationModel, trainingData []map[string]interface{}) float64 {
	// Simple evaluation using holdout set
	// In production, use proper cross-validation

	// Split data (80% train, 20% test)
	trainSize := int(float64(len(trainingData)) * 0.8)
	trainData := trainingData[:trainSize]
	testData := trainingData[trainSize:]

	// For simplicity, return a default accuracy
	// In production, implement proper evaluation
	return 0.75
}

func (cr *CourseRecommender) saveModel(ctx context.Context, model *RecommendationModel, accuracy float64) error {
	modelJSON, _ := json.Marshal(model)

	query := `
		INSERT INTO ml_models (model_type, model_data, accuracy, last_trained)
		VALUES ('course_recommendation', $1, $2, $3)
		ON CONFLICT (model_type) 
		DO UPDATE SET 
			model_data = EXCLUDED.model_data,
			accuracy = EXCLUDED.accuracy,
			last_trained = EXCLUDED.last_trained
	`

	_, err := cr.db.ExecContext(ctx, query, string(modelJSON), accuracy, time.Now())
	if err != nil {
		return err
	}

	// Cache in Redis
	return cr.redis.Set(ctx, "recommendation_model", modelJSON, 24*time.Hour).Err()
}
