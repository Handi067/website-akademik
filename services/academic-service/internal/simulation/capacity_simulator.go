package simulation

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type CapacitySimulator struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

type CapacitySimulation struct {
	SimulationID    string               `json:"simulation_id"`
	Scenario        string               `json:"scenario"`
	Parameters      SimulationParameters `json:"parameters"`
	Results         SimulationResults    `json:"results"`
	Insights        []string             `json:"insights"`
	Recommendations []string             `json:"recommendations"`
	CreatedAt       time.Time            `json:"created_at"`
}

type SimulationParameters struct {
	AcademicYear      int                `json:"academic_year"`
	Semester          string             `json:"semester"`
	StudentCohort     int                `json:"student_cohort"`
	CourseCapacity    map[string]int     `json:"course_capacity"`
	FacultyLoad       map[string]float64 `json:"faculty_load"`
	ClassroomCapacity map[string]int     `json:"classroom_capacity"`
	TimeSlots         []TimeSlot         `json:"time_slots"`
	Constraints       []Constraint       `json:"constraints"`
}

type SimulationResults struct {
	TotalStudents       int                 `json:"total_students"`
	TotalCourses        int                 `json:"total_courses"`
	EnrollmentDemand    map[string]int      `json:"enrollment_demand"`
	CapacityUtilization map[string]float64  `json:"capacity_utilization"`
	Conflicts           []Conflict          `json:"conflicts"`
	WaitlistedStudents  int                 `json:"waitlisted_students"`
	FacultyWorkload     map[string]float64  `json:"faculty_workload"`
	ResourceUtilization ResourceUtilization `json:"resource_utilization"`
	PredictedOutcomes   []PredictedOutcome  `json:"predicted_outcomes"`
}

type TimeSlot struct {
	Day       string `json:"day"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

type Constraint struct {
	Type        string      `json:"type"`
	Description string      `json:"description"`
	Value       interface{} `json:"value"`
}

type Conflict struct {
	Type        string   `json:"type"`
	Description string   `json:"description"`
	CourseIDs   []string `json:"course_ids"`
	StudentIDs  []string `json:"student_ids"`
	Severity    string   `json:"severity"`
}

type ResourceUtilization struct {
	Classrooms   map[string]float64 `json:"classrooms"`
	Faculty      map[string]float64 `json:"faculty"`
	Laboratories map[string]float64 `json:"laboratories"`
	Equipment    map[string]float64 `json:"equipment"`
}

type PredictedOutcome struct {
	Metric         string  `json:"metric"`
	PredictedValue float64 `json:"predicted_value"`
	Confidence     float64 `json:"confidence"`
	Timeframe      string  `json:"timeframe"`
}

type EnrollmentDemand struct {
	CourseID        string  `json:"course_id"`
	CourseName      string  `json:"course_name"`
	PredictedDemand int     `json:"predicted_demand"`
	Capacity        int     `json:"capacity"`
	DemandRatio     float64 `json:"demand_ratio"`
	Priority        string  `json:"priority"`
	RiskLevel       string  `json:"risk_level"`
}

func NewCapacitySimulator(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *CapacitySimulator {
	return &CapacitySimulator{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

func (cs *CapacitySimulator) RunCapacitySimulation(ctx context.Context, params SimulationParameters) (*CapacitySimulation, error) {
	simulationID := fmt.Sprintf("sim_%d", time.Now().Unix())

	cs.logger.WithFields(logrus.Fields{
		"simulation_id": simulationID,
		"scenario":      params.Semester,
		"year":          params.AcademicYear,
	}).Info("Starting capacity simulation")

	// Get historical data for prediction
	historicalData, err := cs.getHistoricalData(ctx, params.AcademicYear, params.Semester)
	if err != nil {
		return nil, fmt.Errorf("failed to get historical data: %w", err)
	}

	// Predict enrollment demand
	enrollmentDemand, err := cs.predictEnrollmentDemand(ctx, params, historicalData)
	if err != nil {
		return nil, fmt.Errorf("failed to predict enrollment demand: %w", err)
	}

	// Calculate capacity utilization
	capacityUtilization := cs.calculateCapacityUtilization(params, enrollmentDemand)

	// Identify conflicts
	conflicts := cs.identifyConflicts(params, enrollmentDemand)

	// Calculate faculty workload
	facultyWorkload := cs.calculateFacultyWorkload(params, enrollmentDemand)

	// Calculate resource utilization
	resourceUtilization := cs.calculateResourceUtilization(params, enrollmentDemand)

	// Predict outcomes
	predictedOutcomes := cs.predictOutcomes(params, enrollmentDemand, historicalData)

	// Generate insights and recommendations
	insights := cs.generateInsights(params, enrollmentDemand, capacityUtilization, conflicts)
	recommendations := cs.generateRecommendations(params, enrollmentDemand, capacityUtilization, conflicts)

	results := SimulationResults{
		TotalStudents:       params.StudentCohort,
		TotalCourses:        len(params.CourseCapacity),
		EnrollmentDemand:    cs.convertEnrollmentDemand(enrollmentDemand),
		CapacityUtilization: capacityUtilization,
		Conflicts:           conflicts,
		WaitlistedStudents:  cs.calculateWaitlistedStudents(enrollmentDemand, params.CourseCapacity),
		FacultyWorkload:     facultyWorkload,
		ResourceUtilization: resourceUtilization,
		PredictedOutcomes:   predictedOutcomes,
	}

	simulation := &CapacitySimulation{
		SimulationID:    simulationID,
		Scenario:        fmt.Sprintf("%s %d", params.Semester, params.AcademicYear),
		Parameters:      params,
		Results:         results,
		Insights:        insights,
		Recommendations: recommendations,
		CreatedAt:       time.Now(),
	}

	// Save simulation results
	err = cs.saveSimulationResults(ctx, simulation)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to save simulation results")
	}

	cs.logger.WithField("simulation_id", simulationID).Info("Capacity simulation completed")
	return simulation, nil
}

func (cs *CapacitySimulator) getHistoricalData(ctx context.Context, academicYear int, semester string) (map[string]interface{}, error) {
	// Get historical enrollment data
	query := `
		SELECT 
			c.id,
			c.name,
			COUNT(sc.student_id) as historical_enrollment,
			c.capacity,
			AVG(sg.grade_points) as avg_grade,
			COUNT(DISTINCT sc.student_id) * 100.0 / c.capacity as fill_rate
		FROM courses c
		LEFT JOIN student_courses sc ON c.id = sc.course_id 
			AND sc.academic_year = $1 
			AND sc.semester = $2
		LEFT JOIN student_grades sg ON c.id = sg.course_id AND sc.student_id = sg.student_id
		WHERE c.academic_year = $1 - 1 
		AND c.semester = $2
		GROUP BY c.id, c.name, c.capacity
		ORDER BY fill_rate DESC
	`

	rows, err := cs.db.QueryContext(ctx, query, academicYear, semester)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	historicalData := make(map[string]interface{})
	var courses []map[string]interface{}

	for rows.Next() {
		var courseID, courseName string
		var historicalEnrollment, capacity int
		var avgGrade, fillRate float64

		err := rows.Scan(&courseID, &courseName, &historicalEnrollment, &capacity, &avgGrade, &fillRate)
		if err != nil {
			continue
		}

		course := map[string]interface{}{
			"course_id":             courseID,
			"course_name":           courseName,
			"historical_enrollment": historicalEnrollment,
			"capacity":              capacity,
			"avg_grade":             avgGrade,
			"fill_rate":             fillRate,
		}

		courses = append(courses, course)
	}

	historicalData["courses"] = courses
	historicalData["total_students"] = cs.getHistoricalStudentCount(ctx, academicYear-1, semester)

	return historicalData, nil
}

func (cs *CapacitySimulator) getHistoricalStudentCount(ctx context.Context, academicYear int, semester string) int {
	query := `
		SELECT COUNT(DISTINCT student_id)
		FROM student_courses
		WHERE academic_year = $1 AND semester = $2
	`

	var count int
	err := cs.db.QueryRowContext(ctx, query, academicYear, semester).Scan(&count)
	if err != nil {
		return 0
	}

	return count
}

func (cs *CapacitySimulator) predictEnrollmentDemand(ctx context.Context, params SimulationParameters, historicalData map[string]interface{}) ([]EnrollmentDemand, error) {
	var enrollmentDemand []EnrollmentDemand

	courses, ok := historicalData["courses"].([]map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid historical data format")
	}

	for _, course := range courses {
		courseID := course["course_id"].(string)
		courseName := course["course_name"].(string)
		historicalEnrollment := course["historical_enrollment"].(int)
		capacity := course["capacity"].(int)
		fillRate := course["fill_rate"].(float64)

		// Predict demand using multiple factors
		baseDemand := float64(historicalEnrollment)

		// Apply growth factor based on student cohort increase
		growthFactor := float64(params.StudentCohort) / float64(historicalData["total_students"].(int))

		// Apply trend factor based on historical fill rate
		trendFactor := 1.0
		if fillRate > 0.9 {
			trendFactor = 1.1 // High demand course
		} else if fillRate < 0.6 {
			trendFactor = 0.9 // Low demand course
		}

		// Apply seasonal adjustment
		seasonalFactor := cs.getSeasonalFactor(params.Semester)

		predictedDemand := int(math.Round(baseDemand * growthFactor * trendFactor * seasonalFactor))

		// Get course capacity from parameters
		courseCapacity, exists := params.CourseCapacity[courseID]
		if !exists {
			courseCapacity = capacity // Use historical capacity if not specified
		}

		demandRatio := float64(predictedDemand) / float64(courseCapacity)
		priority := cs.determinePriority(demandRatio, fillRate)
		riskLevel := cs.determineRiskLevel(demandRatio)

		enrollmentDemand = append(enrollmentDemand, EnrollmentDemand{
			CourseID:        courseID,
			CourseName:      courseName,
			PredictedDemand: predictedDemand,
			Capacity:        courseCapacity,
			DemandRatio:     demandRatio,
			Priority:        priority,
			RiskLevel:       riskLevel,
		})
	}

	return enrollmentDemand, nil
}

func (cs *CapacitySimulator) getSeasonalFactor(semester string) float64 {
	// Seasonal adjustment factors based on historical patterns
	switch semester {
	case "fall":
		return 1.1 // Higher enrollment in fall
	case "spring":
		return 1.0 // Normal enrollment
	case "summer":
		return 0.7 // Lower enrollment in summer
	case "winter":
		return 0.8 // Lower enrollment in winter
	default:
		return 1.0
	}
}

func (cs *CapacitySimulator) determinePriority(demandRatio, fillRate float64) string {
	if demandRatio > 1.2 || fillRate > 0.9 {
		return "high"
	} else if demandRatio > 1.0 || fillRate > 0.7 {
		return "medium"
	} else {
		return "low"
	}
}

func (cs *CapacitySimulator) determineRiskLevel(demandRatio float64) string {
	if demandRatio > 1.5 {
		return "critical"
	} else if demandRatio > 1.2 {
		return "high"
	} else if demandRatio > 1.0 {
		return "medium"
	} else {
		return "low"
	}
}

func (cs *CapacitySimulator) calculateCapacityUtilization(params SimulationParameters, enrollmentDemand []EnrollmentDemand) map[string]float64 {
	utilization := make(map[string]float64)

	for _, demand := range enrollmentDemand {
		utilization[demand.CourseID] = demand.DemandRatio
	}

	return utilization
}

func (cs *CapacitySimulator) identifyConflicts(params SimulationParameters, enrollmentDemand []EnrollmentDemand) []Conflict {
	var conflicts []Conflict

	// Check for time slot conflicts
	timeSlotConflicts := cs.identifyTimeSlotConflicts(params, enrollmentDemand)
	conflicts = append(conflicts, timeSlotConflicts...)

	// Check for faculty conflicts
	facultyConflicts := cs.identifyFacultyConflicts(params, enrollmentDemand)
	conflicts = append(conflicts, facultyConflicts...)

	// Check for classroom conflicts
	classroomConflicts := cs.identifyClassroomConflicts(params, enrollmentDemand)
	conflicts = append(conflicts, classroomConflicts...)

	return conflicts
}

func (cs *CapacitySimulator) identifyTimeSlotConflicts(params SimulationParameters, enrollmentDemand []EnrollmentDemand) []Conflict {
	var conflicts []Conflict

	// Group courses by time slots
	timeSlotGroups := make(map[string][]EnrollmentDemand)
	for _, demand := range enrollmentDemand {
		// This would need course schedule data - simplified for now
		timeSlotGroups["morning"] = append(timeSlotGroups["morning"], demand)
		timeSlotGroups["afternoon"] = append(timeSlotGroups["afternoon"], demand)
		timeSlotGroups["evening"] = append(timeSlotGroups["evening"], demand)
	}

	// Check for overcapacity in time slots
	for timeSlot, courses := range timeSlotGroups {
		totalDemand := 0
		for _, course := range courses {
			totalDemand += course.PredictedDemand
		}

		// Get time slot capacity (simplified)
		timeSlotCapacity := 500 // This would come from classroom capacity data

		if totalDemand > timeSlotCapacity {
			conflicts = append(conflicts, Conflict{
				Type:        "time_slot_overcapacity",
				Description: fmt.Sprintf("Time slot %s exceeds capacity", timeSlot),
				Severity:    "high",
			})
		}
	}

	return conflicts
}

func (cs *CapacitySimulator) identifyFacultyConflicts(params SimulationParameters, enrollmentDemand []EnrollmentDemand) []Conflict {
	var conflicts []Conflict

	// Check faculty workload against constraints
	for faculty, maxLoad := range params.FacultyLoad {
		currentLoad := 0.0

		// Calculate current load based on course assignments
		for _, demand := range enrollmentDemand {
			// This would need faculty-course assignment data
			// Simplified: assume 3 credits per course
			currentLoad += float64(demand.PredictedDemand) * 3.0 / float64(demand.Capacity)
		}

		if currentLoad > maxLoad {
			conflicts = append(conflicts, Conflict{
				Type:        "faculty_overload",
				Description: fmt.Sprintf("Faculty %s workload exceeds maximum", faculty),
				Severity:    "medium",
			})
		}
	}

	return conflicts
}

func (cs *CapacitySimulator) identifyClassroomConflicts(params SimulationParameters, enrollmentDemand []EnrollmentDemand) []Conflict {
	var conflicts []Conflict

	// Check classroom capacity
	for classroom, capacity := range params.ClassroomCapacity {
		currentUsage := 0

		// Calculate current usage based on course assignments
		for _, demand := range enrollmentDemand {
			// This would need classroom-course assignment data
			// Simplified: distribute evenly
			currentUsage += demand.PredictedDemand / len(params.ClassroomCapacity)
		}

		if currentUsage > capacity {
			conflicts = append(conflicts, Conflict{
				Type:        "classroom_overcapacity",
				Description: fmt.Sprintf("Classroom %s exceeds capacity", classroom),
				Severity:    "high",
			})
		}
	}

	return conflicts
}

func (cs *CapacitySimulator) calculateFacultyWorkload(params SimulationParameters, enrollmentDemand []EnrollmentDemand) map[string]float64 {
	workload := make(map[string]float64)

	// Simplified calculation - would need actual faculty assignments
	for faculty := range params.FacultyLoad {
		workload[faculty] = 0.0

		// Calculate based on course assignments
		for _, demand := range enrollmentDemand {
			// Assume even distribution for now
			workload[faculty] += float64(demand.PredictedDemand) * 3.0 / float64(len(params.FacultyLoad))
		}
	}

	return workload
}

func (cs *CapacitySimulator) calculateResourceUtilization(params SimulationParameters, enrollmentDemand []EnrollmentDemand) ResourceUtilization {
	utilization := ResourceUtilization{
		Classrooms:   make(map[string]float64),
		Faculty:      make(map[string]float64),
		Laboratories: make(map[string]float64),
		Equipment:    make(map[string]float64),
	}

	// Calculate classroom utilization
	for classroom, capacity := range params.ClassroomCapacity {
		usage := 0
		for _, demand := range enrollmentDemand {
			// Simplified: distribute evenly
			usage += demand.PredictedDemand / len(params.ClassroomCapacity)
		}
		utilization.Classrooms[classroom] = float64(usage) / float64(capacity)
	}

	// Calculate faculty utilization
	for faculty := range params.FacultyLoad {
		maxLoad := params.FacultyLoad[faculty]
		currentLoad := utilization.Faculty[faculty]
		utilization.Faculty[faculty] = currentLoad / maxLoad
	}

	return utilization
}

func (cs *CapacitySimulator) predictOutcomes(params SimulationParameters, enrollmentDemand []EnrollmentDemand, historicalData map[string]interface{}) []PredictedOutcome {
	var outcomes []PredictedOutcome

	// Predict overall enrollment rate
	totalDemand := 0
	totalCapacity := 0
	for _, demand := range enrollmentDemand {
		totalDemand += demand.PredictedDemand
		totalCapacity += demand.Capacity
	}

	enrollmentRate := float64(totalDemand) / float64(totalCapacity)
	outcomes = append(outcomes, PredictedOutcome{
		Metric:         "enrollment_rate",
		PredictedValue: enrollmentRate,
		Confidence:     0.85,
		Timeframe:      "semester",
	})

	// Predict waitlisted students
	waitlisted := int(math.Max(0, float64(totalDemand-totalCapacity)))
	outcomes = append(outcomes, PredictedOutcome{
		Metric:         "waitlisted_students",
		PredictedValue: float64(waitlisted),
		Confidence:     0.80,
		Timeframe:      "semester",
	})

	// Predict average class size
	avgClassSize := float64(totalDemand) / float64(len(enrollmentDemand))
	outcomes = append(outcomes, PredictedOutcome{
		Metric:         "average_class_size",
		PredictedValue: avgClassSize,
		Confidence:     0.90,
		Timeframe:      "semester",
	})

	// Predict resource utilization
	avgUtilization := 0.0
	for _, demand := range enrollmentDemand {
		avgUtilization += demand.DemandRatio
	}
	avgUtilization /= float64(len(enrollmentDemand))

	outcomes = append(outcomes, PredictedOutcome{
		Metric:         "resource_utilization",
		PredictedValue: avgUtilization,
		Confidence:     0.75,
		Timeframe:      "semester",
	})

	return outcomes
}

func (cs *CapacitySimulator) generateInsights(params SimulationParameters, enrollmentDemand []EnrollmentDemand, capacityUtilization map[string]float64, conflicts []Conflict) []string {
	var insights []string

	// Overall capacity insights
	totalDemand := 0
	totalCapacity := 0
	overcapacityCourses := 0

	for _, demand := range enrollmentDemand {
		totalDemand += demand.PredictedDemand
		totalCapacity += demand.Capacity
		if demand.DemandRatio > 1.0 {
			overcapacityCourses++
		}
	}

	if overcapacityCourses > 0 {
		insights = append(insights, fmt.Sprintf("%d courses are predicted to be overcapacity", overcapacityCourses))
	}

	if float64(totalDemand)/float64(totalCapacity) > 1.1 {
		insights = append(insights, "Overall demand significantly exceeds available capacity")
	}

	// Conflict insights
	if len(conflicts) > 0 {
		insights = append(insights, fmt.Sprintf("%d potential conflicts identified", len(conflicts)))
	}

	// High-demand courses insight
	highDemandCourses := 0
	for _, demand := range enrollmentDemand {
		if demand.Priority == "high" {
			highDemandCourses++
		}
	}

	if highDemandCourses > 0 {
		insights = append(insights, fmt.Sprintf("%d courses are predicted to have high demand", highDemandCourses))
	}

	return insights
}

func (cs *CapacitySimulator) generateRecommendations(params SimulationParameters, enrollmentDemand []EnrollmentDemand, capacityUtilization map[string]float64, conflicts []Conflict) []string {
	var recommendations []string

	// Capacity recommendations
	overcapacityCourses := 0
	for _, demand := range enrollmentDemand {
		if demand.DemandRatio > 1.2 {
			overcapacityCourses++
		}
	}

	if overcapacityCourses > 0 {
		recommendations = append(recommendations, "Consider increasing capacity for high-demand courses")
		recommendations = append(recommendations, "Add additional sections for overcapacity courses")
	}

	// Conflict resolution recommendations
	if len(conflicts) > 0 {
		recommendations = append(recommendations, "Review and resolve identified scheduling conflicts")
		recommendations = append(recommendations, "Optimize time slot assignments to minimize conflicts")
	}

	// Resource optimization recommendations
	recommendations = append(recommendations, "Consider reallocating resources based on predicted demand")
	recommendations = append(recommendations, "Implement priority enrollment for high-demand courses")

	return recommendations
}

func (cs *CapacitySimulator) calculateWaitlistedStudents(enrollmentDemand []EnrollmentDemand, courseCapacity map[string]int) int {
	totalWaitlisted := 0

	for _, demand := range enrollmentDemand {
		if demand.PredictedDemand > demand.Capacity {
			totalWaitlisted += demand.PredictedDemand - demand.Capacity
		}
	}

	return totalWaitlisted
}

func (cs *CapacitySimulator) convertEnrollmentDemand(enrollmentDemand []EnrollmentDemand) map[string]int {
	converted := make(map[string]int)

	for _, demand := range enrollmentDemand {
		converted[demand.CourseID] = demand.PredictedDemand
	}

	return converted
}

func (cs *CapacitySimulator) saveSimulationResults(ctx context.Context, simulation *CapacitySimulation) error {
	// Save to database
	query := `
		INSERT INTO capacity_simulations (
			simulation_id, scenario, parameters, results, 
			insights, recommendations, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	paramsJSON, _ := json.Marshal(simulation.Parameters)
	resultsJSON, _ := json.Marshal(simulation.Results)
	insightsJSON, _ := json.Marshal(simulation.Insights)
	recommendationsJSON, _ := json.Marshal(simulation.Recommendations)

	_, err := cs.db.ExecContext(ctx, query,
		simulation.SimulationID, simulation.Scenario, paramsJSON,
		resultsJSON, insightsJSON, recommendationsJSON, simulation.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to save simulation: %w", err)
	}

	// Cache in Redis
	simulationJSON, _ := json.Marshal(simulation)
	cacheKey := fmt.Sprintf("capacity_simulation:%s", simulation.SimulationID)
	return cs.redis.Set(ctx, cacheKey, simulationJSON, 24*time.Hour).Err()
}

func (cs *CapacitySimulator) GetSimulationResults(ctx context.Context, simulationID string) (*CapacitySimulation, error) {
	// Try to get from cache first
	cacheKey := fmt.Sprintf("capacity_simulation:%s", simulationID)
	cachedSimulation, err := cs.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var simulation CapacitySimulation
		err = json.Unmarshal([]byte(cachedSimulation), &simulation)
		if err == nil {
			return &simulation, nil
		}
	}

	// Get from database
	query := `
		SELECT scenario, parameters, results, insights, recommendations, created_at
		FROM capacity_simulations
		WHERE simulation_id = $1
	`

	var scenario string
	var paramsJSON, resultsJSON, insightsJSON, recommendationsJSON string
	var createdAt time.Time

	err = cs.db.QueryRowContext(ctx, query, simulationID).Scan(
		&scenario, &paramsJSON, &resultsJSON, &insightsJSON, &recommendationsJSON, &createdAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get simulation: %w", err)
	}

	var params SimulationParameters
	var results SimulationResults
	json.Unmarshal([]byte(paramsJSON), &params)
	json.Unmarshal([]byte(resultsJSON), &results)

	simulation := &CapacitySimulation{
		SimulationID:    simulationID,
		Scenario:        scenario,
		Parameters:      params,
		Results:         results,
		Insights:        []string{}, // Would parse from JSON
		Recommendations: []string{}, // Would parse from JSON
		CreatedAt:       createdAt,
	}

	// Cache the result
	simulationJSON, err := json.Marshal(simulation)
	if err != nil {
		cs.logger.WithError(err).Error("Failed to marshal simulation")
		return nil, err
	}
	cs.redis.Set(ctx, cacheKey, string(simulationJSON), time.Hour)

	return simulation, nil
}
