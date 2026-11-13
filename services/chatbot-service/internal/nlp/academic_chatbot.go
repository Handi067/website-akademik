package nlp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/academic-system/chatbot-service/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type AcademicChatbot struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
	nlp    *models.NLPProcessor
}

type ChatMessage struct {
	MessageID  string    `json:"message_id"`
	UserID     string    `json:"user_id"`
	SessionID  string    `json:"session_id"`
	Message    string    `json:"message"`
	Intent     string    `json:"intent"`
	Entities   []Entity  `json:"entities"`
	Response   string    `json:"response"`
	Confidence float64   `json:"confidence"`
	Timestamp  time.Time `json:"timestamp"`
	Channel    string    `json:"channel"`
	Language   string    `json:"language"`
}

type Intent struct {
	Name       string            `json:"name"`
	Confidence float64           `json:"confidence"`
	Parameters map[string]string `json:"parameters"`
}

type Entity struct {
	Type       string  `json:"type"`
	Value      string  `json:"value"`
	Confidence float64 `json:"confidence"`
	StartIndex int     `json:"start_index"`
	EndIndex   int     `json:"end_index"`
}

type ChatResponse struct {
	ResponseID  string                 `json:"response_id"`
	Message     string                 `json:"message"`
	Intent      string                 `json:"intent"`
	Confidence  float64                `json:"confidence"`
	Actions     []Action               `json:"actions"`
	Data        map[string]interface{} `json:"data"`
	Suggestions []string               `json:"suggestions"`
	FollowUp    bool                   `json:"follow_up"`
	Timestamp   time.Time              `json:"timestamp"`
}

type Action struct {
	Type        string                 `json:"type"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	URL         string                 `json:"url"`
	Method      string                 `json:"method"`
}

type ConversationContext struct {
	SessionID       string                     `json:"session_id"`
	UserID          string                     `json:"user_id"`
	PreviousIntents []string                   `json:"previous_intents"`
	Entities        map[string][]models.Entity `json:"entities"`
	Variables       map[string]interface{}     `json:"variables"`
	LastActivity    time.Time                  `json:"last_activity"`
	Language        string                     `json:"language"`
	StudentProfile  *StudentProfile            `json:"student_profile"`
}

type StudentProfile struct {
	StudentID      string   `json:"student_id"`
	Name           string   `json:"name"`
	Program        string   `json:"program"`
	Year           int      `json:"year"`
	GPA            float64  `json:"gpa"`
	CurrentCourses []string `json:"current_courses"`
	Interests      []string `json:"interests"`
	Permissions    []string `json:"permissions"`
}

func NewAcademicChatbot(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *AcademicChatbot {
	return &AcademicChatbot{
		db:     db,
		redis:  redis,
		logger: logger,
		nlp: &models.NLPProcessor{
			ModelPath:     "/models/nlp",
			Intents:       make(map[string]models.Intent),
			Entities:      make(map[string]models.Entity),
			IsInitialized: false,
		},
	}
}

func (ac *AcademicChatbot) ProcessMessage(ctx context.Context, userID, message string) (*ChatResponse, error) {
	// Get or create conversation context
	convContext, err := ac.getConversationContext(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation context: %w", err)
	}

	// Process message with NLP (simplified for now)
	intent := models.Intent{Name: "unknown"}
	entities := []models.Entity{}

	// Update context
	ac.updateContext(ctx, convContext, intent, entities)

	// Generate response based on intent
	response, err := ac.generateResponse(ctx, intent, entities, convContext)
	if err != nil {
		return nil, fmt.Errorf("failed to generate response: %w", err)
	}

	// Save conversation
	err = ac.saveConversation(ctx, userID, message, response)
	if err != nil {
		ac.logger.WithError(err).Warn("Failed to save conversation")
	}

	return response, nil
}

func (ac *AcademicChatbot) getConversationContext(ctx context.Context, userID string) (*ConversationContext, error) {
	// Try to get active session from cache
	cacheKey := fmt.Sprintf("chat_context:%s", userID)
	cachedContext, err := ac.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var context ConversationContext
		err = json.Unmarshal([]byte(cachedContext), &context)
		if err == nil {
			// Update last activity
			context.LastActivity = time.Now()
			ac.saveContext(ctx, userID, &context)
			return &context, nil
		}
	}

	// Create new context
	studentProfile, err := ac.getStudentProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get student profile: %w", err)
	}

	convContext := &ConversationContext{
		SessionID:       ac.generateSessionID(),
		UserID:          userID,
		PreviousIntents: []string{},
		Entities:        make(map[string][]models.Entity),
		Variables:       make(map[string]interface{}),
		LastActivity:    time.Now(),
		Language:        "en", // Default, would be detected
		StudentProfile:  studentProfile,
	}

	return convContext, nil
}

func (ac *AcademicChatbot) getStudentProfile(ctx context.Context, userID string) (*StudentProfile, error) {
	query := `
		SELECT 
			s.id, s.name, sp.program_id, s.year, s.gpa,
			COALESCE(
				ARRAY_AGG(DISTINCT c.code ORDER BY c.code), 
				ARRAY[]::text
			) as current_courses,
			COALESCE(
				ARRAY_AGG(DISTINCT si.interest ORDER BY si.interest), 
				ARRAY[]::text
			) as interests,
			COALESCE(
				ARRAY_AGG(DISTINCT rp.permission ORDER BY rp.permission), 
				ARRAY[]::text
			) as permissions
		FROM students s
		LEFT JOIN student_programs sp ON s.id = sp.student_id AND sp.status = 'active'
		LEFT JOIN student_courses sc ON s.id = sc.student_id AND sc.status = 'enrolled'
		LEFT JOIN courses c ON sc.course_id = c.id
		LEFT JOIN student_interests si ON s.id = si.student_id
		LEFT JOIN role_permissions rp ON s.role_id = rp.role_id
		WHERE s.id = $1
		GROUP BY s.id, s.name, sp.program_id, s.year, s.gpa
	`

	var profile StudentProfile
	var currentCourses, interests, permissions []string

	err := ac.db.QueryRowContext(ctx, query, userID).Scan(
		&profile.StudentID, &profile.Name, &profile.Program, &profile.Year,
		&profile.GPA, &currentCourses, &interests, &permissions,
	)
	if err != nil {
		return nil, err
	}

	profile.CurrentCourses = currentCourses
	profile.Interests = interests
	profile.Permissions = permissions

	return &profile, nil
}

func (ac *AcademicChatbot) generateResponse(ctx context.Context, intent models.Intent, entities []models.Entity, convContext *ConversationContext) (*ChatResponse, error) {
	// Route to appropriate handler based on intent
	switch intent.Name {
	case "grade_inquiry":
		return ac.handleGradeInquiry(ctx, entities, convContext)
	case "schedule_inquiry":
		return ac.handleScheduleInquiry(ctx, entities, convContext)
	case "assignment_help":
		return ac.handleAssignmentHelp(ctx, entities, convContext)
	case "course_info":
		return ac.handleCourseInfo(ctx, entities, convContext)
	case "deadline_inquiry":
		return ac.handleDeadlineInquiry(ctx, entities, convContext)
	case "payment_inquiry":
		return ac.handlePaymentInquiry(ctx, entities, convContext)
	case "library_services":
		return ac.handleLibraryServices(ctx, entities, convContext)
	case "technical_support":
		return ac.handleTechnicalSupport(ctx, entities, convContext)
	case "academic_advising":
		return ac.handleAcademicAdvising(ctx, entities, convContext)
	case "registration_help":
		return ac.handleRegistrationHelp(ctx, entities, convContext)
	case "campus_info":
		return ac.handleCampusInfo(ctx, entities, convContext)
	case "greeting":
		return ac.handleGreeting(ctx, entities, convContext)
	case "goodbye":
		return ac.handleGoodbye(ctx, entities, convContext)
	default:
		return ac.handleFallback(ctx, intent, entities, convContext)
	}
}

func (ac *AcademicChatbot) handleGradeInquiry(ctx context.Context, entities []models.Entity, convContext *ConversationContext) (*ChatResponse, error) {
	response := &ChatResponse{
		ResponseID:  ac.generateResponseID(),
		Intent:      "grade_inquiry",
		Confidence:  0.8,
		Actions:     []Action{},
		Data:        make(map[string]interface{}),
		Suggestions: []string{},
		FollowUp:    true,
		Timestamp:   time.Now(),
	}

	// Extract course entity
	var courseName string
	for _, entity := range entities {
		if entity.Type == "course" && len(entity.Values) > 0 {
			courseName = entity.Values[0]
			break
		}
	}

	if courseName != "" {
		// Get specific course grades
		grades, err := ac.getCourseGrades(ctx, convContext.StudentProfile.StudentID, courseName)
		if err != nil {
			response.Message = "I'm having trouble accessing your grades right now. Please try again later."
			return response, nil
		}

		if len(grades) > 0 {
			response.Message = fmt.Sprintf("Here are your grades for %s:", courseName)
			response.Data["grades"] = grades
			response.Actions = append(response.Actions, Action{
				Type:        "view_grades",
				Description: "View detailed grade report",
				URL:         "/grades",
				Method:      "GET",
			})
		} else {
			response.Message = fmt.Sprintf("I don't see any grades for %s. You may not be enrolled in this course.", courseName)
		}
	} else {
		// Get overall grades (simplified)
		response.Message = "Here's your overall academic performance:"
		response.Data["overall_grades"] = map[string]interface{}{
			"gpa":     convContext.StudentProfile.GPA,
			"program": convContext.StudentProfile.Program,
		}
		response.Actions = append(response.Actions, Action{
			Type:        "view_transcript",
			Description: "View full transcript",
			URL:         "/transcript",
			Method:      "GET",
		})
	}

	response.Suggestions = []string{
		"Show me my GPA",
		"What are my missing assignments?",
		"When is my next exam?",
	}

	return response, nil
}

func (ac *AcademicChatbot) handleScheduleInquiry(ctx context.Context, entities []models.Entity, convContext *ConversationContext) (*ChatResponse, error) {
	response := &ChatResponse{
		ResponseID:  ac.generateResponseID(),
		Intent:      "schedule_inquiry",
		Confidence:  0.8,
		Actions:     []Action{},
		Data:        make(map[string]interface{}),
		Suggestions: []string{},
		FollowUp:    true,
		Timestamp:   time.Now(),
	}

	// Extract date entity
	var dateFilter string
	for _, entity := range entities {
		if entity.Type == "date" && len(entity.Values) > 0 {
			dateFilter = entity.Values[0]
			break
		}
	}

	schedule, err := ac.getStudentSchedule(ctx, convContext.StudentProfile.StudentID, dateFilter)
	if err != nil {
		response.Message = "I'm having trouble accessing your schedule right now. Please try again later."
		return response, nil
	}

	if len(schedule) > 0 {
		response.Message = "Here's your class schedule:"
		response.Data["schedule"] = schedule
		response.Actions = append(response.Actions, Action{
			Type:        "view_calendar",
			Description: "View full calendar",
			URL:         "/calendar",
			Method:      "GET",
		})
	} else {
		response.Message = "I don't see any classes scheduled for the specified time."
	}

	response.Suggestions = []string{
		"Show me tomorrow's schedule",
		"What classes do I have this week?",
		"Are there any schedule changes?",
	}

	return response, nil
}

func (ac *AcademicChatbot) handleAssignmentHelp(ctx context.Context, entities []models.Entity, convContext *ConversationContext) (*ChatResponse, error) {
	response := &ChatResponse{
		ResponseID:  ac.generateResponseID(),
		Intent:      "assignment_help",
		Confidence:  0.8,
		Actions:     []Action{},
		Data:        make(map[string]interface{}),
		Suggestions: []string{},
		FollowUp:    true,
		Timestamp:   time.Now(),
	}

	// Extract course entity
	var courseName string
	for _, entity := range entities {
		if entity.Type == "course" && len(entity.Values) > 0 {
			courseName = entity.Values[0]
			break
		}
	}

	assignments, err := ac.getPendingAssignments(ctx, convContext.StudentProfile.StudentID, courseName)
	if err != nil {
		response.Message = "I'm having trouble accessing your assignments right now. Please try again later."
		return response, nil
	}

	if len(assignments) > 0 {
		response.Message = "Here are your pending assignments:"
		response.Data["assignments"] = assignments
		response.Actions = append(response.Actions, Action{
			Type:        "view_assignments",
			Description: "View all assignments",
			URL:         "/assignments",
			Method:      "GET",
		})
	} else {
		response.Message = "You don't have any pending assignments."
	}

	response.Suggestions = []string{
		"Show me overdue assignments",
		"What assignments are due this week?",
		"Help me with a specific assignment",
	}

	return response, nil
}

func (ac *AcademicChatbot) handleCourseInfo(ctx context.Context, entities []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	response := &ChatResponse{
		ResponseID:  ac.generateResponseID(),
		Intent:      "course_info",
		Confidence:  0.8,
		Actions:     []Action{},
		Data:        make(map[string]interface{}),
		Suggestions: []string{},
		FollowUp:    true,
		Timestamp:   time.Now(),
	}

	// Extract course entity
	var courseName string
	for _, entity := range entities {
		if entity.Type == "course" && len(entity.Values) > 0 {
			courseName = entity.Values[0]
			break
		}
	}

	if courseName == "" {
		response.Message = "Which course would you like information about?"
		response.Suggestions = []string{
			"Tell me about Mathematics 101",
			"What's covered in Computer Science 201?",
			"Show me my current courses",
		}
		return response, nil
	}

	courseInfo, err := ac.getCourseInfo(ctx, courseName)
	if err != nil {
		response.Message = "I'm having trouble accessing course information right now. Please try again later."
		return response, nil
	}

	response.Message = fmt.Sprintf("Here's information about %s:", courseName)
	response.Data["course_info"] = courseInfo
	response.Actions = append(response.Actions, Action{
		Type:        "view_course",
		Description: fmt.Sprintf("View %s details", courseName),
		URL:         fmt.Sprintf("/courses/%s", courseName),
		Method:      "GET",
	})

	response.Suggestions = []string{
		"Show me the syllabus",
		"Who is the instructor?",
		"What are the prerequisites?",
	}

	return response, nil
}

func (ac *AcademicChatbot) handleGreeting(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	hour := time.Now().Hour()
	var greeting string

	switch {
	case hour < 12:
		greeting = "Good morning"
	case hour < 17:
		greeting = "Good afternoon"
	default:
		greeting = "Good evening"
	}

	response := &ChatResponse{
		ResponseID: ac.generateResponseID(),
		Message:    fmt.Sprintf("%s! I'm your academic assistant. How can I help you today?", greeting),
		Intent:     "greeting",
		Confidence: 0.9,
		Actions: []Action{
			{
				Type:        "view_grades",
				Description: "Check your grades",
				URL:         "/grades",
				Method:      "GET",
			},
			{
				Type:        "view_schedule",
				Description: "See your schedule",
				URL:         "/schedule",
				Method:      "GET",
			},
			{
				Type:        "view_assignments",
				Description: "Check assignments",
				URL:         "/assignments",
				Method:      "GET",
			},
		},
		Data: make(map[string]interface{}),
		Suggestions: []string{
			"Check my grades",
			"View my schedule",
			"Show my assignments",
			"Help with enrollment",
		},
		FollowUp:  true,
		Timestamp: time.Now(),
	}

	return response, nil
}

func (ac *AcademicChatbot) handleFallback(ctx context.Context, intent models.Intent, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	response := &ChatResponse{
		ResponseID: ac.generateResponseID(),
		Message:    "I'm not sure I understand. Could you please rephrase your question?",
		Intent:     intent.Name,
		Confidence: 0.3,
		Actions: []Action{
			{
				Type:        "contact_support",
				Description: "Contact human support",
				URL:         "/support",
				Method:      "GET",
			},
		},
		Data: make(map[string]interface{}),
		Suggestions: []string{
			"Check my grades",
			"View my schedule",
			"Show my assignments",
			"Help with enrollment",
			"Technical support",
		},
		FollowUp:  true,
		Timestamp: time.Now(),
	}

	return response, nil
}

// Helper methods for data retrieval
func (ac *AcademicChatbot) getCourseGrades(ctx context.Context, studentID, courseName string) ([]map[string]interface{}, error) {
	query := `
		SELECT c.name, c.code, sg.grade_points, sg.letter_grade, sg.graded_at
		FROM student_grades sg
		JOIN courses c ON sg.course_id = c.id
		WHERE sg.student_id = $1 AND c.name ILIKE '%' || $2 || '%'
		ORDER BY sg.graded_at DESC
	`

	rows, err := ac.db.QueryContext(ctx, query, studentID, courseName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var grades []map[string]interface{}
	for rows.Next() {
		var grade map[string]interface{}
		var name, code, letterGrade string
		var gradePoints float64
		var gradedAt time.Time

		err := rows.Scan(&name, &code, &gradePoints, &letterGrade, &gradedAt)
		if err != nil {
			continue
		}

		grade = map[string]interface{}{
			"course_name":  name,
			"course_code":  code,
			"grade_points": gradePoints,
			"letter_grade": letterGrade,
			"graded_at":    gradedAt,
		}

		grades = append(grades, grade)
	}

	return grades, nil
}

func (ac *AcademicChatbot) getStudentSchedule(ctx context.Context, studentID, dateFilter string) ([]map[string]interface{}, error) {
	query := `
		SELECT c.name, c.code, cs.day_of_week, cs.start_time, cs.end_time, cs.room
		FROM course_sessions cs
		JOIN courses c ON cs.course_id = c.id
		JOIN student_courses sc ON cs.course_id = sc.course_id
		WHERE sc.student_id = $1 AND sc.status = 'enrolled'
	`

	if dateFilter != "" {
		query += " AND cs.session_date::date = CURRENT_DATE + INTERVAL '" + dateFilter + "'"
	}

	query += " ORDER BY cs.day_of_week, cs.start_time"

	rows, err := ac.db.QueryContext(ctx, query, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedule []map[string]interface{}
	for rows.Next() {
		var session map[string]interface{}
		var name, code, dayOfWeek, startTime, endTime, room string

		err := rows.Scan(&name, &code, &dayOfWeek, &startTime, &endTime, &room)
		if err != nil {
			continue
		}

		session = map[string]interface{}{
			"course_name": name,
			"course_code": code,
			"day_of_week": dayOfWeek,
			"start_time":  startTime,
			"end_time":    endTime,
			"room":        room,
		}

		schedule = append(schedule, session)
	}

	return schedule, nil
}

func (ac *AcademicChatbot) getPendingAssignments(ctx context.Context, studentID, courseName string) ([]map[string]interface{}, error) {
	query := `
		SELECT a.title, a.description, a.due_date, c.name as course_name, c.code as course_code
		FROM assignments a
		JOIN courses c ON a.course_id = c.id
		JOIN student_assignments sa ON a.id = sa.assignment_id
		WHERE sa.student_id = $1 AND sa.submitted_at IS NULL
	`

	if courseName != "" {
		query += " AND c.name ILIKE '%' || $2 || '%'"
	}

	query += " ORDER BY a.due_date ASC"

	rows, err := ac.db.QueryContext(ctx, query, studentID, courseName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []map[string]interface{}
	for rows.Next() {
		var assignment map[string]interface{}
		var title, description, courseName, courseCode string
		var dueDate time.Time

		err := rows.Scan(&title, &description, &dueDate, &courseName, &courseCode)
		if err != nil {
			continue
		}

		assignment = map[string]interface{}{
			"title":       title,
			"description": description,
			"due_date":    dueDate,
			"course_name": courseName,
			"course_code": courseCode,
		}

		assignments = append(assignments, assignment)
	}

	return assignments, nil
}

func (ac *AcademicChatbot) getCourseInfo(ctx context.Context, courseName string) (map[string]interface{}, error) {
	query := `
		SELECT c.name, c.code, c.description, c.credits, c.instructor_id,
			   i.name as instructor_name, i.email as instructor_email
		FROM courses c
		LEFT JOIN instructors i ON c.instructor_id = i.id
		WHERE c.name ILIKE '%' || $1 || '%'
		LIMIT 1
	`

	var courseInfo map[string]interface{}
	var name, code, description, instructorName, instructorEmail string
	var credits int
	var instructorID sql.NullString

	err := ac.db.QueryRowContext(ctx, query, courseName).Scan(
		&name, &code, &description, &credits, &instructorID,
		&instructorName, &instructorEmail,
	)
	if err != nil {
		return nil, err
	}

	courseInfo = map[string]interface{}{
		"name":        name,
		"code":        code,
		"description": description,
		"credits":     credits,
		"instructor":  instructorName,
		"email":       instructorEmail,
	}

	return courseInfo, nil
}

func (ac *AcademicChatbot) updateContext(ctx context.Context, context *ConversationContext, intent models.Intent, entities []models.Entity) {
	// Add intent to previous intents
	context.PreviousIntents = append(context.PreviousIntents, intent.Name)
	if len(context.PreviousIntents) > 10 {
		context.PreviousIntents = context.PreviousIntents[1:] // Keep last 10
	}

	// Update entities
	for _, entity := range entities {
		context.Entities[entity.Type] = append(context.Entities[entity.Type], entity)
	}

	// Update last activity
	context.LastActivity = time.Now()

	// Save updated context
	ac.saveContext(ctx, context.UserID, context)
}

func (ac *AcademicChatbot) saveContext(ctx context.Context, userID string, context *ConversationContext) error {
	contextJSON, _ := json.Marshal(context)
	cacheKey := fmt.Sprintf("chat_context:%s", userID)
	return ac.redis.Set(ctx, cacheKey, contextJSON, 2*time.Hour).Err()
}

func (ac *AcademicChatbot) saveConversation(ctx context.Context, userID, message string, response *ChatResponse) error {
	query := `
		INSERT INTO chat_conversations (
			user_id, session_id, message, intent, response,
			confidence, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	responseJSON, _ := json.Marshal(response)

	_, err := ac.db.ExecContext(ctx, query,
		userID, response.ResponseID, message, response.Intent,
		responseJSON, response.Confidence, time.Now(),
	)

	return err
}

func (ac *AcademicChatbot) generateSessionID() string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("session_%d", timestamp)
}

func (ac *AcademicChatbot) generateResponseID() string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("response_%d", timestamp)
}

// Additional handlers would be implemented similarly...
func (ac *AcademicChatbot) handleDeadlineInquiry(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for deadline inquiries
	return &ChatResponse{
		Message:     "I can help you check deadlines. What specific deadlines are you interested in?",
		Intent:      "deadline_inquiry",
		Confidence:  0.8,
		Suggestions: []string{"Show me this week's deadlines", "What assignments are due soon?"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handlePaymentInquiry(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for payment inquiries
	return &ChatResponse{
		Message:     "I can help you with payment information. What would you like to know about?",
		Intent:      "payment_inquiry",
		Confidence:  0.8,
		Suggestions: []string{"Check my payment status", "View payment history", "Payment due dates"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleLibraryServices(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for library services
	return &ChatResponse{
		Message:     "I can help you with library services. What do you need?",
		Intent:      "library_services",
		Confidence:  0.8,
		Suggestions: []string{"Book availability", "Library hours", "Research databases"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleTechnicalSupport(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for technical support
	return &ChatResponse{
		Message:    "I understand you're having technical issues. Let me help you or connect you with technical support.",
		Intent:     "technical_support",
		Confidence: 0.8,
		Actions: []Action{{
			Type:        "contact_support",
			Description: "Create support ticket",
			URL:         "/support/ticket",
			Method:      "POST",
		}},
		Suggestions: []string{"Create support ticket", "Check system status", "FAQ"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleAcademicAdvising(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for academic advising
	return &ChatResponse{
		Message:     "I can help with academic advising. What specific guidance do you need?",
		Intent:      "academic_advising",
		Confidence:  0.8,
		Suggestions: []string{"Course planning", "Degree requirements", "Academic standing"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleRegistrationHelp(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for registration help
	return &ChatResponse{
		Message:     "I can help you with course registration. What do you need assistance with?",
		Intent:      "registration_help",
		Confidence:  0.8,
		Suggestions: []string{"Course registration", "Add/drop courses", "Registration deadlines"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleCampusInfo(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	// Implementation for campus information
	return &ChatResponse{
		Message:     "I can help you with campus information. What would you like to know?",
		Intent:      "campus_info",
		Confidence:  0.8,
		Suggestions: []string{"Campus map", "Office hours", "Campus events"},
		Timestamp:   time.Now(),
	}, nil
}

func (ac *AcademicChatbot) handleGoodbye(_ context.Context, _ []models.Entity, _ *ConversationContext) (*ChatResponse, error) {
	return &ChatResponse{
		Message:    "Thank you for using the academic assistant. Have a great day!",
		Intent:     "goodbye",
		Confidence: 0.9,
		Timestamp:  time.Now(),
	}, nil
}
