package certificate

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/academic-system/blockchain-service/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/sirupsen/logrus"
)

type CertificateVerifier struct {
	db     *sql.DB
	redis  *redis.Client
	logger *logrus.Logger
}

type Certificate struct {
	CertificateID   string    `json:"certificate_id"`
	StudentID       string    `json:"student_id"`
	ProgramID       string    `json:"program_id"`
	CertificateType string    `json:"certificate_type"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	IssuedAt        time.Time `json:"issued_at"`
	ExpiresAt       time.Time `json:"expires_at"`
	IssuingAuthority string    `json:"issuing_authority"`
	Hash            string    `json:"hash"`
	PreviousHash    string    `json:"previous_hash"`
	BlockNumber     int64     `json:"block_number"`
	TransactionID   string    `json:"transaction_id"`
	Metadata        map[string]interface{} `json:"metadata"`
	IsRevoked       bool      `json:"is_revoked"`
	RevokedAt       *time.Time `json:"revoked_at"`
	RevocationReason string    `json:"revocation_reason"`
}

type VerificationRequest struct {
	RequestID       string    `json:"request_id"`
	CertificateID   string    `json:"certificate_id"`
	VerifierID      string    `json:"verifier_id"`
	VerifierName    string    `json:"verifier_name"`
	VerifierOrg     string    `json:"verifier_org"`
	Purpose         string    `json:"purpose"`
	RequestedAt     time.Time `json:"requested_at"`
	IPAddress       string    `json:"ip_address"`
	UserAgent       string    `json:"user_agent"`
	Status          string    `json:"status"`
}

type VerificationResult struct {
	RequestID       string              `json:"request_id"`
	Certificate     *Certificate         `json:"certificate"`
	IsValid         bool               `json:"is_valid"`
	IsRevoked       bool               `json:"is_revoked"`
	VerificationHash string             `json:"verification_hash"`
	BlockchainData  BlockchainData      `json:"blockchain_data"`
	VerifiedAt      time.Time          `json:"verified_at"`
	VerifierInfo   VerifierInfo       `json:"verifier_info"`
	RiskFactors     []string           `json:"risk_factors"`
	Confidence      float64            `json:"confidence"`
}

type BlockchainData struct {
	TransactionID   string    `json:"transaction_id"`
	BlockNumber     int64     `json:"block_number"`
	BlockHash       string    `json:"block_hash"`
	Timestamp       time.Time `json:"timestamp"`
	Confirmations   int       `json:"confirmations"`
	NetworkStatus   string    `json:"network_status"`
	GasUsed         int64     `json:"gas_used"`
}

type VerifierInfo struct {
	VerifierID      string    `json:"verifier_id"`
	VerifierName    string    `json:"verifier_name"`
	VerifierOrg     string    `json:"verifier_org"`
	TrustLevel      string    `json:"trust_level"`
	VerificationCount int       `json:"verification_count"`
	LastVerified    time.Time `json:"last_verified"`
}

type DigitalSignature struct {
	Signature       string    `json:"signature"`
	Algorithm       string    `json:"algorithm"`
	PublicKey       string    `json:"public_key"`
	SignedAt        time.Time `json:"signed_at"`
	SignerID        string    `json:"signer_id"`
	SignerName      string    `json:"signer_name"`
}

func NewCertificateVerifier(db *sql.DB, redis *redis.Client, logger *logrus.Logger) *CertificateVerifier {
	return &CertificateVerifier{
		db:     db,
		redis:  redis,
		logger: logger,
	}
}

func (cv *CertificateVerifier) IssueCertificate(ctx context.Context, cert *Certificate) (*Certificate, error) {
	// Generate certificate hash
	certHash := cv.generateCertificateHash(cert)
	
	// Get previous hash for blockchain linkage
	previousHash, err := cv.getLatestBlockHash(ctx)
	if err != nil {
		cv.logger.WithError(err).Warn("Failed to get latest block hash, using empty")
		previousHash = ""
	}
	
	// Set certificate hash and previous hash
	cert.Hash = certHash
	cert.PreviousHash = previousHash
	cert.IssuedAt = time.Now()
	
	// Create blockchain transaction
	txID, blockNumber, err := cv.createBlockchainTransaction(ctx, cert)
	if err != nil {
		return nil, fmt.Errorf("failed to create blockchain transaction: %w", err)
	}
	
	cert.TransactionID = txID
	cert.BlockNumber = blockNumber
	
	// Save certificate to database
	err = cv.saveCertificate(ctx, cert)
	if err != nil {
		return nil, fmt.Errorf("failed to save certificate: %w", err)
	}
	
	// Cache certificate
	err = cv.cacheCertificate(ctx, cert)
	if err != nil {
		cv.logger.WithError(err).Warn("Failed to cache certificate")
	}
	
	cv.logger.WithFields(logrus.Fields{
		"certificate_id": cert.CertificateID,
		"student_id":    cert.StudentID,
		"transaction_id": txID,
		"block_number":   blockNumber,
	}).Info("Certificate issued on blockchain")
	
	return cert, nil
}

func (cv *CertificateVerifier) VerifyCertificate(ctx context.Context, certificateID string, verifierInfo VerifierInfo) (*VerificationResult, error) {
	// Create verification request
	request := &VerificationRequest{
		RequestID:   cv.generateRequestID(),
		CertificateID: certificateID,
		VerifierID:   verifierInfo.VerifierID,
		VerifierName: verifierInfo.VerifierName,
		VerifierOrg:  verifierInfo.VerifierOrg,
		Purpose:      "certificate_verification",
		RequestedAt:  time.Now(),
		Status:       "pending",
	}
	
	// Save verification request
	err := cv.saveVerificationRequest(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("failed to save verification request: %w", err)
	}
	
	// Get certificate from cache or database
	cert, err := cv.getCertificate(ctx, certificateID)
	if err != nil {
		return nil, fmt.Errorf("certificate not found: %w", err)
	}
	
	// Verify certificate on blockchain
	blockchainData, err := cv.verifyOnBlockchain(ctx, cert.TransactionID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify on blockchain: %w", err)
	}
	
	// Perform additional validations
	isValid, riskFactors := cv.performAdditionalValidations(ctx, cert, blockchainData)
	
	// Calculate verification hash
	verificationHash := cv.generateVerificationHash(cert, blockchainData, verifierInfo)
	
	// Update verifier statistics
	err = cv.updateVerifierStats(ctx, verifierInfo.VerifierID)
	if err != nil {
		cv.logger.WithError(err).Warn("Failed to update verifier stats")
	}
	
	// Create verification result
	result := &VerificationResult{
		RequestID:       request.RequestID,
		Certificate:     cert,
		IsValid:         isValid,
		IsRevoked:       cert.IsRevoked,
		VerificationHash: verificationHash,
		BlockchainData:  blockchainData,
		VerifiedAt:      time.Now(),
		VerifierInfo:   verifierInfo,
		RiskFactors:     riskFactors,
		Confidence:      cv.calculateConfidence(isValid, riskFactors, blockchainData),
	}
	
	// Save verification result
	err = cv.saveVerificationResult(ctx, result)
	if err != nil {
		cv.logger.WithError(err).Error("Failed to save verification result")
	}
	
	// Update verification request status
	err = cv.updateVerificationRequest(ctx, request.RequestID, "completed", result)
	if err != nil {
		cv.logger.WithError(err).Error("Failed to update verification request")
	}
	
	cv.logger.WithFields(logrus.Fields{
		"request_id":     request.RequestID,
		"certificate_id":  certificateID,
		"is_valid":       isValid,
		"verifier_id":    verifierInfo.VerifierID,
	}).Info("Certificate verification completed")
	
	return result, nil
}

func (cv *CertificateVerifier) generateCertificateHash(cert *Certificate) string {
	// Create canonical representation of certificate
	certData := map[string]interface{}{
		"student_id":         cert.StudentID,
		"program_id":         cert.ProgramID,
		"certificate_type":    cert.CertificateType,
		"title":              cert.Title,
		"description":        cert.Description,
		"issued_at":          cert.IssuedAt,
		"expires_at":         cert.ExpiresAt,
		"issuing_authority":  cert.IssuingAuthority,
		"metadata":           cert.Metadata,
	}
	
	// Convert to JSON and hash
	certJSON, _ := json.Marshal(certData)
	return fmt.Sprintf("%x", sha256.Sum256(certJSON))
}

func (cv *CertificateVerifier) getLatestBlockHash(ctx context.Context) (string, error) {
	query := `
		SELECT block_hash 
		FROM blockchain_blocks 
		ORDER BY block_number DESC 
		LIMIT 1
	`
	
	var blockHash string
	err := cv.db.QueryRowContext(ctx, query).Scan(&blockHash)
	if err != nil {
		return "", err
	}
	
	return blockHash, nil
}

func (cv *CertificateVerifier) createBlockchainTransaction(ctx context.Context, cert *Certificate) (string, int64, error) {
	// Generate transaction ID
	txID := cv.generateTransactionID()
	
	// Get next block number
	var blockNumber int64
	query := `
		SELECT COALESCE(MAX(block_number), 0) + 1
		FROM blockchain_blocks
	`
	err := cv.db.QueryRowContext(ctx, query).Scan(&blockNumber)
	if err != nil {
		return "", 0, err
	}
	
	// Create blockchain transaction
	txQuery := `
		INSERT INTO blockchain_transactions (
			transaction_id, block_number, certificate_id, 
			transaction_data, created_at
		) VALUES ($1, $2, $3, $4, $5)
	`
	
	txData := map[string]interface{}{
		"certificate_id":   cert.CertificateID,
		"certificate_hash": cert.Hash,
		"previous_hash":    cert.PreviousHash,
		"issued_at":       cert.IssuedAt,
		"expires_at":      cert.ExpiresAt,
	}
	
	txDataJSON, _ := json.Marshal(txData)
	
	_, err = cv.db.ExecContext(ctx, txQuery, txID, blockNumber, cert.CertificateID, txDataJSON, time.Now())
	if err != nil {
		return "", 0, err
	}
	
	// Create block
	blockQuery := `
		INSERT INTO blockchain_blocks (
			block_number, block_hash, transaction_ids, 
			created_at
		) VALUES ($1, $2, $3, $4)
	`
	
	blockHash := cv.generateBlockHash(blockNumber, cert.Hash, cert.PreviousHash)
	transactionIDs := []string{txID}
	
	_, err = cv.db.ExecContext(ctx, blockQuery, blockNumber, blockHash, transactionIDs, time.Now())
	if err != nil {
		return "", 0, err
	}
	
	return txID, blockNumber, nil
}

func (cv *CertificateVerifier) generateTransactionID() string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("cert_tx_%d", timestamp)
}

func (cv *CertificateVerifier) generateBlockHash(blockNumber int64, certHash, previousHash string) string {
	blockData := map[string]interface{}{
		"block_number":    blockNumber,
		"certificate_hash": certHash,
		"previous_hash":   previousHash,
		"timestamp":       time.Now(),
	}
	
	blockJSON, _ := json.Marshal(blockData)
	return fmt.Sprintf("%x", sha256.Sum256(blockJSON))
}

func (cv *CertificateVerifier) saveCertificate(ctx context.Context, cert *Certificate) error {
	query := `
		INSERT INTO certificates (
			certificate_id, student_id, program_id, certificate_type,
			title, description, issued_at, expires_at, issuing_authority,
			hash, previous_hash, block_number, transaction_id,
			metadata, is_revoked
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (certificate_id) 
		DO UPDATE SET 
			hash = EXCLUDED.hash,
			previous_hash = EXCLUDED.previous_hash,
			block_number = EXCLUDED.block_number,
			transaction_id = EXCLUDED.transaction_id,
			metadata = EXCLUDED.metadata
	`
	
	metadataJSON, _ := json.Marshal(cert.Metadata)
	
	_, err := cv.db.ExecContext(ctx, query,
		cert.CertificateID, cert.StudentID, cert.ProgramID, cert.CertificateType,
		cert.Title, cert.Description, cert.IssuedAt, cert.ExpiresAt,
		cert.IssuingAuthority, cert.Hash, cert.PreviousHash,
		cert.BlockNumber, cert.TransactionID, metadataJSON, cert.IsRevoked,
	)
	
	return err
}

func (cv *CertificateVerifier) cacheCertificate(ctx context.Context, cert *Certificate) error {
	certJSON, _ := json.Marshal(cert)
	cacheKey := fmt.Sprintf("certificate:%s", cert.CertificateID)
	
	return cv.redis.Set(ctx, cacheKey, certJSON, 24*time.Hour).Err()
}

func (cv *CertificateVerifier) getCertificate(ctx context.Context, certificateID string) (*Certificate, error) {
	// Try cache first
	cacheKey := fmt.Sprintf("certificate:%s", certificateID)
	cachedCert, err := cv.redis.Get(ctx, cacheKey).Result()
	if err == nil {
		var cert Certificate
		err = json.Unmarshal([]byte(cachedCert), &cert)
		if err == nil {
			return &cert, nil
		}
	}
	
	// Get from database
	query := `
		SELECT 
			certificate_id, student_id, program_id, certificate_type,
			title, description, issued_at, expires_at, issuing_authority,
			hash, previous_hash, block_number, transaction_id,
			metadata, is_revoked, revoked_at, revocation_reason
		FROM certificates
		WHERE certificate_id = $1
	`
	
	var cert Certificate
	var metadataJSON string
	var revokedAt, revocationReason sql.NullString
	
	err = cv.db.QueryRowContext(ctx, query, certificateID).Scan(
		&cert.CertificateID, &cert.StudentID, &cert.ProgramID, &cert.CertificateType,
		&cert.Title, &cert.Description, &cert.IssuedAt, &cert.ExpiresAt,
		&cert.IssuingAuthority, &cert.Hash, &cert.PreviousHash,
		&cert.BlockNumber, &cert.TransactionID, &metadataJSON,
		&cert.IsRevoked, &revokedAt, &revocationReason,
	)
	if err != nil {
		return nil, err
	}
	
	// Parse metadata
	json.Unmarshal([]byte(metadataJSON), &cert.Metadata)
	
	// Handle nullable fields
	if revokedAt.Valid {
		cert.RevokedAt = &revokedAt.Time
	}
	if revocationReason.Valid {
		cert.RevocationReason = revocationReason.String
	}
	
	// Cache the certificate
	cv.cacheCertificate(ctx, &cert)
	
	return &cert, nil
}

func (cv *CertificateVerifier) verifyOnBlockchain(ctx context.Context, transactionID string) (BlockchainData, error) {
	// Get transaction from blockchain
	query := `
		SELECT 
			bt.transaction_id, bt.block_number, bt.block_hash,
			bt.created_at, bt.confirmations, bt.network_status, bt.gas_used
		FROM blockchain_transactions bt
		WHERE bt.transaction_id = $1
	`
	
	var blockchainData BlockchainData
	err := cv.db.QueryRowContext(ctx, query, transactionID).Scan(
		&blockchainData.TransactionID, &blockchainData.BlockNumber,
		&blockchainData.BlockHash, &blockchainData.Timestamp,
		&blockchainData.Confirmations, &blockchainData.NetworkStatus,
		&blockchainData.GasUsed,
	)
	if err != nil {
		return BlockchainData{}, err
	}
	
	return blockchainData, nil
}

func (cv *CertificateVerifier) performAdditionalValidations(ctx context.Context, cert *Certificate, blockchainData BlockchainData) (bool, []string) {
	var riskFactors []string
	isValid := true
	
	// Check if certificate is revoked
	if cert.IsRevoked {
		isValid = false
		riskFactors = append(riskFactors, "certificate_revoked")
	}
	
	// Check if certificate is expired
	if time.Now().After(cert.ExpiresAt) {
		isValid = false
		riskFactors = append(riskFactors, "certificate_expired")
	}
	
	// Check blockchain confirmations
	if blockchainData.Confirmations < 3 {
		isValid = false
		riskFactors = append(riskFactors, "insufficient_confirmations")
	}
	
	// Check network status
	if blockchainData.NetworkStatus != "confirmed" {
		isValid = false
		riskFactors = append(riskFactors, "network_not_confirmed")
	}
	
	// Verify certificate hash integrity
	if err := cv.verifyCertificateHash(cert); err != nil {
		isValid = false
		riskFactors = append(riskFactors, "hash_integrity_failed")
	}
	
	return isValid, riskFactors
}

func (cv *CertificateVerifier) verifyCertificateHash(cert *Certificate) error {
	// Recalculate hash and compare
	expectedHash := cv.generateCertificateHash(cert)
	
	if cert.Hash != expectedHash {
		return fmt.Errorf("certificate hash mismatch")
	}
	
	return nil
}

func (cv *CertificateVerifier) generateVerificationHash(cert *Certificate, blockchainData BlockchainData, verifierInfo VerifierInfo) string {
	verificationData := map[string]interface{}{
		"certificate_id":     cert.CertificateID,
		"certificate_hash":  cert.Hash,
		"block_number":      blockchainData.BlockNumber,
		"block_hash":        blockchainData.BlockHash,
		"transaction_id":    blockchainData.TransactionID,
		"verifier_id":       verifierInfo.VerifierID,
		"verified_at":        time.Now(),
	}
	
	verificationJSON, _ := json.Marshal(verificationData)
	return fmt.Sprintf("%x", sha256.Sum256(verificationJSON))
}

func (cv *CertificateVerifier) calculateConfidence(isValid bool, riskFactors []string, blockchainData BlockchainData) float64 {
	confidence := 1.0
	
	// Reduce confidence based on risk factors
	for _, risk := range riskFactors {
		switch risk {
		case "certificate_revoked":
			confidence -= 0.5
		case "certificate_expired":
			confidence -= 0.3
		case "insufficient_confirmations":
			confidence -= 0.2 * float64(3-blockchainData.Confirmations) / 3.0
		case "network_not_confirmed":
			confidence -= 0.4
		case "hash_integrity_failed":
			confidence -= 0.6
		}
	}
	
	// Increase confidence based on confirmations
	if blockchainData.Confirmations >= 6 {
		confidence += 0.1
	}
	
	// Ensure confidence is within bounds
	if confidence < 0 {
		confidence = 0
	} else if confidence > 1 {
		confidence = 1
	}
	
	return confidence
}

func (cv *CertificateVerifier) generateRequestID() string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("ver_req_%d", timestamp)
}

func (cv *CertificateVerifier) saveVerificationRequest(ctx context.Context, request *VerificationRequest) error {
	query := `
		INSERT INTO verification_requests (
			request_id, certificate_id, verifier_id, verifier_name,
			verifier_org, purpose, requested_at, ip_address,
			user_agent, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	
	_, err := cv.db.ExecContext(ctx, query,
		request.RequestID, request.CertificateID, request.VerifierID,
		request.VerifierName, request.VerifierOrg, request.Purpose,
		request.RequestedAt, request.IPAddress, request.UserAgent, request.Status,
	)
	
	return err
}

func (cv *CertificateVerifier) updateVerifierStats(ctx context.Context, verifierID string) error {
	query := `
		INSERT INTO verifier_stats (verifier_id, verification_count, last_verified)
		VALUES ($1, 1, NOW())
		ON CONFLICT (verifier_id) 
		DO UPDATE SET 
			verification_count = verifier_stats.verification_count + 1,
			last_verified = EXCLUDED.last_verified
	`
	
	_, err := cv.db.ExecContext(ctx, query, verifierID)
	return err
}

func (cv *CertificateVerifier) saveVerificationResult(ctx context.Context, result *VerificationResult) error {
	query := `
		INSERT INTO verification_results (
			request_id, certificate, is_valid, is_revoked,
			verification_hash, blockchain_data, verified_at,
			verifier_info, risk_factors, confidence
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	
	certJSON, _ := json.Marshal(result.Certificate)
	blockchainJSON, _ := json.Marshal(result.BlockchainData)
	verifierJSON, _ := json.Marshal(result.VerifierInfo)
	riskFactorsJSON, _ := json.Marshal(result.RiskFactors)
	
	_, err := cv.db.ExecContext(ctx, query,
		result.RequestID, certJSON, result.IsValid, result.IsRevoked,
		result.VerificationHash, blockchainJSON, result.VerifiedAt,
		verifierJSON, riskFactorsJSON, result.Confidence,
	)
	
	return err
}

func (cv *CertificateVerifier) updateVerificationRequest(ctx context.Context, requestID, status string, result *VerificationResult) error {
	query := `
		UPDATE verification_requests
		SET status = $1, updated_at = NOW()
		WHERE request_id = $2
	`
	
	_, err := cv.db.ExecContext(ctx, query, status, requestID)
	return err
}

func (cv *CertificateVerifier) RevokeCertificate(ctx context.Context, certificateID, reason string) error {
	query := `
		UPDATE certificates
		SET is_revoked = true, revoked_at = NOW(), revocation_reason = $1
		WHERE certificate_id = $2
	`
	
	_, err := cv.db.ExecContext(ctx, query, reason, certificateID)
	if err != nil {
		return fmt.Errorf("failed to revoke certificate: %w", err)
	}
	
	// Clear cache
	cacheKey := fmt.Sprintf("certificate:%s", certificateID)
	cv.redis.Del(ctx, cacheKey)
	
	cv.logger.WithFields(logrus.Fields{
		"certificate_id": certificateID,
		"reason":         reason,
	}).Info("Certificate revoked")
	
	return nil
}

func (cv *CertificateVerifier) GetVerificationHistory(ctx context.Context, certificateID string) ([]VerificationResult, error) {
	query := `
		SELECT 
			request_id, certificate, is_valid, is_revoked,
			verification_hash, blockchain_data, verified_at,
			verifier_info, risk_factors, confidence
		FROM verification_results
		WHERE certificate_id = $1
		ORDER BY verified_at DESC
	`
	
	rows, err := cv.db.QueryContext(ctx, query, certificateID)
	if err != nil {
		return nil, fmt.Errorf("failed to get verification history: %w", err)
	}
	defer rows.Close()
	
	var results []VerificationResult
	for rows.Next() {
		var result VerificationResult
		var certJSON, blockchainJSON, verifierJSON, riskFactorsJSON string
		
		err := rows.Scan(
			&result.RequestID, &certJSON, &result.IsValid, &result.IsRevoked,
			&result.VerificationHash, &blockchainJSON, &result.VerifiedAt,
			&verifierJSON, &riskFactorsJSON, &result.Confidence,
		)
		if err != nil {
			continue
		}
		
		// Parse JSON fields
		json.Unmarshal([]byte(certJSON), &result.Certificate)
		json.Unmarshal([]byte(blockchainJSON), &result.BlockchainData)
		json.Unmarshal([]byte(verifierJSON), &result.VerifierInfo)
		json.Unmarshal([]byte(riskFactorsJSON), &result.RiskFactors)
		
		results = append(results, result)
	}
	
	return results, nil
}
