package models

import (
	"time"
)

// CourseResource represents course resources
type CourseResource struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Type        string `json:"type"`
	URL         string `json:"url"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// EnrollmentMetrics represents enrollment metrics
type EnrollmentMetrics struct {
	TotalEnrolled         int     `json:"total_enrolled"`
	ActiveEnrolled        int     `json:"active_enrolled"`
	DropoutRate           float64 `json:"dropout_rate"`
	CompletionRate        float64 `json:"completion_rate"`
	AverageTimeToComplete float64 `json:"average_time_to_complete"`
}

// PerformanceMetrics represents performance metrics
type PerformanceMetrics struct {
	AverageGrade      float64        `json:"average_grade"`
	MedianGrade       float64        `json:"median_grade"`
	GradeDistribution map[string]int `json:"grade_distribution"`
	SuccessRate       float64        `json:"success_rate"`
}

// UtilizationMetrics represents utilization metrics
type UtilizationMetrics struct {
	ResourceUtilization float64 `json:"resource_utilization"`
	TimeUtilization     float64 `json:"time_utilization"`
	CapacityUtilization float64 `json:"capacity_utilization"`
	EfficiencyScore     float64 `json:"efficiency_score"`
}

// WorkloadMetrics represents workload metrics
type WorkloadMetrics struct {
	AverageWorkload  float64   `json:"average_workload"`
	PeakWorkload     float64   `json:"peak_workload"`
	WorkloadBalance  float64   `json:"workload_balance"`
	StressIndicators []float64 `json:"stress_indicators"`
}

// QualityMetrics represents quality metrics
type QualityMetrics struct {
	QualityScore     float64  `json:"quality_score"`
	SatisfactionRate float64  `json:"satisfaction_rate"`
	FeedbackScore    float64  `json:"feedback_score"`
	ImprovementAreas []string `json:"improvement_areas"`
}

// FinancialMetrics represents financial metrics
type FinancialMetrics struct {
	TotalRevenue   float64 `json:"total_revenue"`
	TotalCosts     float64 `json:"total_costs"`
	ProfitMargin   float64 `json:"profit_margin"`
	CostPerStudent float64 `json:"cost_per_student"`
}

// SustainabilityMetrics represents sustainability metrics
type SustainabilityMetrics struct {
	EnergyUsage         float64 `json:"energy_usage"`
	CarbonFootprint     float64 `json:"carbon_footprint"`
	WasteReduction      float64 `json:"waste_reduction"`
	SustainabilityScore float64 `json:"sustainability_score"`
}

// CourseAssignment represents course assignments
type CourseAssignment struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	Type        string    `json:"type"`
	Weight      float64   `json:"weight"`
	Status      string    `json:"status"`
}

// Publication represents academic publications
type Publication struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Authors     []string  `json:"authors"`
	Journal     string    `json:"journal"`
	PublishDate time.Time `json:"publish_date"`
	Type        string    `json:"type"`
	Citations   int       `json:"citations"`
}

// Grant represents research grants
type Grant struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Amount    float64   `json:"amount"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Status    string    `json:"status"`
	Agency    string    `json:"agency"`
}

// Project represents research projects
type Project struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	Status      string    `json:"status"`
	Budget      float64   `json:"budget"`
	TeamMembers []string  `json:"team_members"`
}

// Presentation represents academic presentations
type Presentation struct {
	ID       string    `json:"id"`
	Title    string    `json:"title"`
	Event    string    `json:"event"`
	Date     time.Time `json:"date"`
	Type     string    `json:"type"`
	Location string    `json:"location"`
}

// Patent represents patents
type Patent struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Inventors  []string  `json:"inventors"`
	FilingDate time.Time `json:"filing_date"`
	GrantDate  time.Time `json:"grant_date"`
	Status     string    `json:"status"`
	Number     string    `json:"number"`
}

// Collaboration represents research collaborations
type Collaboration struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Partners  []string  `json:"partners"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
}

// StudentPerformance represents student performance metrics
type StudentPerformance struct {
	Grades         []Grade      `json:"grades"`
	Attendance     []Attendance `json:"attendance"`
	Assignments    []Assignment `json:"assignments"`
	OverallGPA     float64      `json:"overall_gpa"`
	CompletionRate float64      `json:"completion_rate"`
}

// StudentBehavior represents student behavior patterns
type StudentBehavior struct {
	StudyPatterns    []StudyPattern `json:"study_patterns"`
	EngagementScore  float64        `json:"engagement_score"`
	InteractionTypes []string       `json:"interaction_types"`
	PreferredTime    string         `json:"preferred_time"`
}

// StudentPredictions represents student predictions
type StudentPredictions struct {
	SuccessProbability float64  `json:"success_probability"`
	DropoutRisk        float64  `json:"dropout_risk"`
	OptimalPath        []string `json:"optimal_path"`
	RecommendedActions []string `json:"recommended_actions"`
}

// Grade represents a grade
type Grade struct {
	CourseCode string  `json:"course_code"`
	CourseName string  `json:"course_name"`
	Grade      string  `json:"grade"`
	Score      float64 `json:"score"`
	Credits    int     `json:"credits"`
	Semester   string  `json:"semester"`
}

// Attendance represents attendance records
type Attendance struct {
	CourseCode string    `json:"course_code"`
	Date       time.Time `json:"date"`
	Status     string    `json:"status"`
	Duration   int       `json:"duration"`
}

// Assignment represents assignments
type Assignment struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	DueDate     time.Time `json:"due_date"`
	Type        string    `json:"type"`
	Weight      float64   `json:"weight"`
	Status      string    `json:"status"`
}

// StudyPattern represents study patterns
type StudyPattern struct {
	DayOfWeek string  `json:"day_of_week"`
	TimeOfDay string  `json:"time_of_day"`
	Duration  float64 `json:"duration"`
	Activity  string  `json:"activity"`
	Location  string  `json:"location"`
}

// DigitalTwinModel represents complete digital twin of university
type DigitalTwinModel struct {
	UniversityID  string                 `json:"university_id"`
	Timestamp     time.Time              `json:"timestamp"`
	Entities      TwinEntities           `json:"entities"`
	Relationships []Relationship         `json:"relationships"`
	Metrics       TwinMetrics            `json:"metrics"`
	Simulations   []SimulationResult     `json:"simulations"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// TwinEntities contains all entities in digital twin
type TwinEntities struct {
	Students   []StudentEntity  `json:"students"`
	Faculty    []FacultyEntity  `json:"faculty"`
	Courses    []CourseEntity   `json:"courses"`
	Facilities []FacilityEntity `json:"facilities"`
	Resources  []ResourceEntity `json:"resources"`
}

// StudentEntity represents a student in the digital twin
type StudentEntity struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	Email            string                 `json:"email"`
	Program          string                 `json:"program"`
	Year             int                    `json:"year"`
	GPA              float64                `json:"gpa"`
	Status           string                 `json:"status"`
	EnrollmentDate   time.Time              `json:"enrollment_date"`
	CurrentCourses   []string               `json:"current_courses"`
	CompletedCourses []string               `json:"completed_courses"`
	Skills           []string               `json:"skills"`
	Interests        []string               `json:"interests"`
	CareerGoals      []string               `json:"career_goals"`
	Performance      StudentPerformance     `json:"performance"`
	Behavior         StudentBehavior        `json:"behavior"`
	Predictions      StudentPredictions     `json:"predictions"`
	Attributes       map[string]interface{} `json:"attributes"`
}

// FacultyEntity represents a faculty member in the digital twin
type FacultyEntity struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	Email          string                 `json:"email"`
	Department     string                 `json:"department"`
	Rank           string                 `json:"rank"`
	Specialization []string               `json:"specialization"`
	HireDate       time.Time              `json:"hire_date"`
	Status         string                 `json:"status"`
	TeachingLoad   TeachingLoad           `json:"teaching_load"`
	Research       ResearchActivity       `json:"research"`
	Service        ServiceActivity        `json:"service"`
	Performance    FacultyPerformance     `json:"performance"`
	Predictions    FacultyPredictions     `json:"predictions"`
	Attributes     map[string]interface{} `json:"attributes"`
}

// TeachingLoad represents teaching load metrics
type TeachingLoad struct {
	CoursesTaught   int     `json:"courses_taught"`
	StudentCount    int     `json:"student_count"`
	CreditHours     float64 `json:"credit_hours"`
	PreparationTime float64 `json:"preparation_time"`
	OfficeHours     float64 `json:"office_hours"`
}

// ResearchActivity represents research activities
type ResearchActivity struct {
	Supervision    []Supervision   `json:"supervision"`
	Impact         ResearchImpact  `json:"impact"`
	Projects       []Project       `json:"projects"`
	Publications   []Publication   `json:"publications"`
	Grants         []Grant         `json:"grants"`
	Presentations  []Presentation  `json:"presentations"`
	Patents        []Patent        `json:"patents"`
	Collaborations []Collaboration `json:"collaborations"`
}

// ServiceActivity represents service activities
type ServiceActivity struct {
	CommitteeWork  []Committee      `json:"committee_work"`
	Leadership     []LeadershipRole `json:"leadership"`
	Outreach       []Outreach       `json:"outreach"`
	Reviews        []Review         `json:"reviews"`
	Mentoring      []Mentoring      `json:"mentoring"`
	Administrative []Administrative `json:"administrative"`
}

// FacultyPerformance represents faculty performance metrics
type FacultyPerformance struct {
	Evaluations   []Evaluation  `json:"evaluations"`
	PeerReviews   []PeerReview  `json:"peer_reviews"`
	Awards        []Award       `json:"awards"`
	Recognitions  []Recognition `json:"recognitions"`
	TeachingScore float64       `json:"teaching_score"`
	ResearchScore float64       `json:"research_score"`
	ServiceScore  float64       `json:"service_score"`
}

// FacultyPredictions represents faculty predictions
type FacultyPredictions struct {
	PerformanceTrend     []float64 `json:"performance_trend"`
	ResearchProductivity float64   `json:"research_productivity"`
	CareerProgression    []string  `json:"career_progression"`
	RecommendedActions   []string  `json:"recommended_actions"`
}

// CourseEntity represents a course in the digital twin
type CourseEntity struct {
	ID            string                 `json:"id"`
	Code          string                 `json:"code"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	Credits       int                    `json:"credits"`
	Level         string                 `json:"level"`
	Semester      string                 `json:"semester"`
	Department    string                 `json:"department"`
	Instructor    string                 `json:"instructor"`
	Prerequisites []string               `json:"prerequisites"`
	Corequisites  []string               `json:"corequisites"`
	Enrolled      int                    `json:"enrolled"`
	Waitlist      int                    `json:"waitlist"`
	Schedule      CourseSchedule         `json:"schedule"`
	Requirements  CourseRequirements     `json:"requirements"`
	Outcomes      CourseOutcomes         `json:"outcomes"`
	Resources     []CourseResource       `json:"resources"`
	Analytics     CourseAnalytics        `json:"analytics"`
	Predictions   CoursePredictions      `json:"predictions"`
	Attributes    map[string]interface{} `json:"attributes"`
}

// CourseAnalytics represents course analytics
type CourseAnalytics struct {
	EnrollmentTrend []float64 `json:"enrollment_trend"`
	CompletionRate  float64   `json:"completion_rate"`
	AverageGrade    float64   `json:"average_grade"`
	EngagementScore float64   `json:"engagement_score"`
	DropoutRate     float64   `json:"dropout_rate"`
}

// CoursePredictions represents course predictions
type CoursePredictions struct {
	EnrollmentForecast int      `json:"enrollment_forecast"`
	DemandScore        float64  `json:"demand_score"`
	SuccessProbability float64  `json:"success_probability"`
	ResourceNeeds      []string `json:"resource_needs"`
}

// CourseSchedule represents course schedule
type CourseSchedule struct {
	Sessions  []Session  `json:"sessions"`
	TimeSlots []TimeSlot `json:"time_slots"`
	Location  string     `json:"location"`
	Format    string     `json:"format"`
	Duration  int        `json:"duration"`
}

// CourseRequirements represents course requirements
type CourseRequirements struct {
	Prerequisites []Requirement `json:"prerequisites"`
	Corequisites  []Requirement `json:"corequisites"`
	Skills        []Skill       `json:"skills"`
	Software      []Software    `json:"software"`
	Outcomes      []Outcome     `json:"outcomes"`
}

// CourseOutcomes represents course outcomes
type CourseOutcomes struct {
	LearningOutcomes []Outcome `json:"learning_outcomes"`
	Assessment       []Outcome `json:"assessment"`
	SuccessMetrics   []Outcome `json:"success_metrics"`
}

// Session represents teaching sessions
type Session struct {
	ID         string    `json:"id"`
	CourseCode string    `json:"course_code"`
	Title      string    `json:"title"`
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	Location   string    `json:"location"`
	Type       string    `json:"type"`
	Status     string    `json:"status"`
}

// TimeSlot represents time slots
type TimeSlot struct {
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Available bool      `json:"available"`
}

// Requirement represents course requirements
type Requirement struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Mandatory   bool   `json:"mandatory"`
	Status      string `json:"status"`
}

// Skill represents skills
type Skill struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Category     string    `json:"category"`
	Level        string    `json:"level"`
	AcquiredDate time.Time `json:"acquired_date"`
}

// Software represents software resources
type Software struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Type    string `json:"type"`
	License string `json:"license"`
	Status  string `json:"status"`
}

// Outcome represents learning outcomes
type Outcome struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Measurable  bool   `json:"measurable"`
	Status      string `json:"status"`
}

// FacilityEntity represents a facility in the digital twin
type FacilityEntity struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Location    Location               `json:"location"`
	Capacity    int                    `json:"capacity"`
	Area        float64                `json:"area"`
	Status      string                 `json:"status"`
	Utilization FacilityUtilization    `json:"utilization"`
	Schedule    FacilitySchedule       `json:"schedule"`
	Equipment   []Equipment            `json:"equipment"`
	Maintenance MaintenanceRecord      `json:"maintenance"`
	Analytics   FacilityAnalytics      `json:"analytics"`
	Predictions FacilityPredictions    `json:"predictions"`
	Attributes  map[string]interface{} `json:"attributes"`
}

// Location represents location information
type Location struct {
	Building    string    `json:"building"`
	Room        string    `json:"room"`
	Floor       string    `json:"floor"`
	Coordinates []float64 `json:"coordinates"`
	Capacity    int       `json:"capacity"`
}

// FacilityUtilization represents facility utilization metrics
type FacilityUtilization struct {
	CurrentUsage    float64 `json:"current_usage"`
	PeakUsage       float64 `json:"peak_usage"`
	AverageUsage    float64 `json:"average_usage"`
	EfficiencyScore float64 `json:"efficiency_score"`
}

// FacilitySchedule represents facility schedule
type FacilitySchedule struct {
	Bookings       []Booking           `json:"bookings"`
	AvailableSlots []TimeSlot          `json:"available_slots"`
	Maintenance    []MaintenanceWindow `json:"maintenance"`
}

// Equipment represents equipment in facilities
type Equipment struct {
	ID             string                 `json:"id"`
	Name           string                 `json:"name"`
	Type           string                 `json:"type"`
	Status         string                 `json:"status"`
	Location       string                 `json:"location"`
	Specifications map[string]interface{} `json:"specifications"`
	Maintenance    MaintenanceRecord      `json:"maintenance"`
}

// MaintenanceRecord represents maintenance records
type MaintenanceRecord struct {
	LastMaintenance time.Time `json:"last_maintenance"`
	NextMaintenance time.Time `json:"next_maintenance"`
	MaintenanceType string    `json:"maintenance_type"`
	Cost            float64   `json:"cost"`
	Status          string    `json:"status"`
}

// FacilityAnalytics represents facility analytics
type FacilityAnalytics struct {
	UsagePattern     []UsagePattern `json:"usage_pattern"`
	CostAnalysis     CostAnalysis   `json:"cost_analysis"`
	PerformanceScore float64        `json:"performance_score"`
}

// FacilityPredictions represents facility predictions
type FacilityPredictions struct {
	UtilizationForecast    []float64 `json:"utilization_forecast"`
	MaintenanceNeeds       []string  `json:"maintenance_needs"`
	UpgradeRecommendations []string  `json:"upgrade_recommendations"`
}

// Booking represents a facility booking
type Booking struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Purpose   string    `json:"purpose"`
	Status    string    `json:"status"`
}

// MaintenanceWindow represents maintenance windows
type MaintenanceWindow struct {
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Type      string    `json:"type"`
	Impact    string    `json:"impact"`
}

// UsagePattern represents usage patterns
type UsagePattern struct {
	Period    string  `json:"period"`
	Usage     float64 `json:"usage"`
	Trend     string  `json:"trend"`
	PeakHours []int   `json:"peak_hours"`
}

// CostAnalysis represents cost analysis
type CostAnalysis struct {
	OperationalCost float64 `json:"operational_cost"`
	MaintenanceCost float64 `json:"maintenance_cost"`
	UtilizationCost float64 `json:"utilization_cost"`
	TotalCost       float64 `json:"total_cost"`
}

// ResourceEntity represents a resource in the digital twin
type ResourceEntity struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Type         string                 `json:"type"`
	Category     string                 `json:"category"`
	Status       string                 `json:"status"`
	Availability ResourceAvailability   `json:"availability"`
	Allocation   ResourceAllocation     `json:"allocation"`
	Cost         ResourceCost           `json:"cost"`
	Analytics    ResourceAnalytics      `json:"analytics"`
	Predictions  ResourcePredictions    `json:"predictions"`
	Attributes   map[string]interface{} `json:"attributes"`
}

// ResourceAvailability represents resource availability
type ResourceAvailability struct {
	TotalCapacity   int       `json:"total_capacity"`
	AvailableNow    int       `json:"available_now"`
	ScheduledUsage  []Booking `json:"scheduled_usage"`
	MaintenanceMode bool      `json:"maintenance_mode"`
}

// ResourceAllocation represents resource allocation
type ResourceAllocation struct {
	AllocatedTo    []string  `json:"allocated_to"`
	AllocationDate time.Time `json:"allocation_date"`
	ReturnDate     time.Time `json:"return_date"`
	UsagePattern   []string  `json:"usage_pattern"`
}

// ResourceCost represents resource cost information
type ResourceCost struct {
	AcquisitionCost float64 `json:"acquisition_cost"`
	MaintenanceCost float64 `json:"maintenance_cost"`
	OperatingCost   float64 `json:"operating_cost"`
	TotalCost       float64 `json:"total_cost"`
}

// ResourceAnalytics represents resource analytics
type ResourceAnalytics struct {
	UtilizationRate float64   `json:"utilization_rate"`
	EfficiencyScore float64   `json:"efficiency_score"`
	CostPerUse      float64   `json:"cost_per_use"`
	DemandPattern   []float64 `json:"demand_pattern"`
}

// ResourcePredictions represents resource predictions
type ResourcePredictions struct {
	DemandForecast   []float64 `json:"demand_forecast"`
	OptimalUsage     []string  `json:"optimal_usage"`
	ReplacementNeeds []string  `json:"replacement_needs"`
	CostPredictions  []float64 `json:"cost_predictions"`
}

// Relationship represents relationships between entities
type Relationship struct {
	ID         string                 `json:"id"`
	SourceID   string                 `json:"source_id"`
	TargetID   string                 `json:"target_id"`
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Strength   float64                `json:"strength"`
	Direction  string                 `json:"direction"`
	ValidFrom  time.Time              `json:"valid_from"`
	ValidTo    *time.Time             `json:"valid_to"`
}

// TwinMetrics contains metrics for the digital twin
type TwinMetrics struct {
	Enrollment     EnrollmentMetrics     `json:"enrollment"`
	Performance    PerformanceMetrics    `json:"performance"`
	Utilization    UtilizationMetrics    `json:"utilization"`
	Workload       WorkloadMetrics       `json:"workload"`
	Quality        QualityMetrics        `json:"quality"`
	Financial      FinancialMetrics      `json:"financial"`
	Sustainability SustainabilityMetrics `json:"sustainability"`
}

// SimulationResult represents simulation results
type SimulationResult struct {
	ID         string                 `json:"id"`
	Scenario   string                 `json:"scenario"`
	Parameters map[string]interface{} `json:"parameters"`
	Results    map[string]interface{} `json:"results"`
	Timestamp  time.Time              `json:"timestamp"`
	Accuracy   float64                `json:"accuracy"`
}

// Supporting types for faculty activities

// Supervision represents supervision activities
type Supervision struct {
	StudentID    string    `json:"student_id"`
	SupervisorID string    `json:"supervisor_id"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	Type         string    `json:"type"`
	Status       string    `json:"status"`
}

// ResearchImpact represents research impact metrics
type ResearchImpact struct {
	Publications    int     `json:"publications"`
	Citations       int     `json:"citations"`
	HIndex          int     `json:"h_index"`
	ImpactFactor    float64 `json:"impact_factor"`
	ResearchFunding float64 `json:"research_funding"`
}

// Committee represents committee work
type Committee struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
}

// LeadershipRole represents leadership roles
type LeadershipRole struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Organization string    `json:"organization"`
	StartDate    time.Time `json:"start_date"`
	EndDate      time.Time `json:"end_date"`
	Level        string    `json:"level"`
	Status       string    `json:"status"`
}

// Outreach represents outreach activities
type Outreach struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
	Type        string    `json:"type"`
	Audience    string    `json:"audience"`
	Impact      string    `json:"impact"`
}

// Review represents review activities
type Review struct {
	ID         string    `json:"id"`
	Type       string    `json:"type"`
	ReviewerID string    `json:"reviewer_id"`
	RevieweeID string    `json:"reviewee_id"`
	Date       time.Time `json:"date"`
	Status     string    `json:"status"`
	Rating     float64   `json:"rating"`
	Comments   string    `json:"comments"`
}

// Mentoring represents mentoring activities
type Mentoring struct {
	MentorID  string    `json:"mentor_id"`
	MenteeID  string    `json:"mentee_id"`
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Outcomes  []string  `json:"outcomes"`
}

// Administrative represents administrative duties
type Administrative struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	StartDate   time.Time `json:"start_date"`
	EndDate     time.Time `json:"end_date"`
	Level       string    `json:"level"`
	Status      string    `json:"status"`
}

// Evaluation represents evaluation activities
type Evaluation struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	EvaluatorID string    `json:"evaluator_id"`
	EvaluateeID string    `json:"evaluatee_id"`
	Date        time.Time `json:"date"`
	Status      string    `json:"status"`
	Score       float64   `json:"score"`
	Comments    string    `json:"comments"`
}

// PeerReview represents peer review activities
type PeerReview struct {
	ID         string    `json:"id"`
	ReviewerID string    `json:"reviewer_id"`
	RevieweeID string    `json:"reviewee_id"`
	Content    string    `json:"content"`
	Date       time.Time `json:"date"`
	Status     string    `json:"status"`
	Rating     float64   `json:"rating"`
}

// Award represents awards and recognitions
type Award struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Date         time.Time `json:"date"`
	Type         string    `json:"type"`
	Organization string    `json:"organization"`
	Level        string    `json:"level"`
}

// Recognition represents recognitions
type Recognition struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Date        time.Time `json:"date"`
	Type        string    `json:"type"`
	Source      string    `json:"source"`
	Impact      string    `json:"impact"`
}
