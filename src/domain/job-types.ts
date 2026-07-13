export type JobStatus = 
  | 'wishlist'
  | 'researching'
  | 'applying'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'archived'

export type InterviewType = 
  | 'phone-screen'
  | 'technical'
  | 'behavioral'
  | 'system-design'
  | 'take-home'
  | 'onsite'
  | 'panel'
  | 'final'
  | 'other'

export type SalaryPeriod = 'hourly' | 'daily' | 'monthly' | 'annual'

export interface JobApplication {
  id: number
  companyName: string
  jobTitle: string
  status: JobStatus
  priority: 'high' | 'medium' | 'low'
  
  // URLs and Links
  jobUrl?: string
  companyWebsite?: string
  linkedInUrl?: string
  applicationPortalUrl?: string
  
  // Application Details
  appliedDate?: string
  deadline?: string
  source: string // 'LinkedIn', 'Indeed', 'Company Site', 'Referral', etc.
  referralContact?: string
  
  // Compensation
  salaryMin?: number
  salaryMax?: number
  salaryCurrency: string
  salaryPeriod: SalaryPeriod
  equity?: string
  benefits?: string
  
  // Job Details
  location: string
  remote: 'onsite' | 'hybrid' | 'remote'
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship'
  description?: string
  requirements?: string
  responsibilities?: string
  
  // Application Materials
  cvVersion?: string
  coverLetterVersion?: string
  portfolioUrl?: string
  customDocuments: Array<{
    name: string
    url?: string
    notes?: string
  }>
  
  // Progress Tracking
  interviews: JobInterview[]
  notes: JobNote[]
  contacts: JobContact[]
  tasks: Array<{
    id: number
    description: string
    dueDate?: string
    completed: boolean
    completedAt?: string
  }>
  
  // Metadata
  rating: number // 1-5 stars
  pros?: string
  cons?: string
  rejectionReason?: string
  offerDetails?: string
  
  createdAt: string
  updatedAt: string
  sortOrder?: number
  tags: string[]
}

export interface JobInterview {
  id: number
  type: InterviewType
  scheduledDate: string
  scheduledTime?: string
  duration?: number // minutes
  location?: string
  meetingUrl?: string
  interviewers: string[]
  notes?: string
  preparation?: string
  outcome?: 'pending' | 'passed' | 'failed' | 'cancelled'
  feedback?: string
  createdAt: string
  completedAt?: string
}

export interface JobNote {
  id: number
  content: string
  type: 'general' | 'research' | 'follow-up' | 'feedback' | 'decision'
  createdAt: string
  updatedAt: string
}

export interface JobContact {
  id: number
  name: string
  role: string
  email?: string
  phone?: string
  linkedIn?: string
  notes?: string
  lastContact?: string
}

export interface JobStats {
  total: number
  applied: number
  interviewing: number
  offers: number
  rejected: number
  avgResponseTime: number // days
  interviewRate: number // percentage
  offerRate: number // percentage
}

export type JobSortBy = 
  | 'applied-desc'
  | 'applied-asc'
  | 'deadline-asc'
  | 'salary-desc'
  | 'rating-desc'
  | 'updated-desc'
  | 'company-asc'

export type JobFilterBy = 
  | 'all'
  | 'active'
  | 'wishlist'
  | 'applied'
  | 'interviewing'
  | 'offers'
  | 'rejected'
  | 'high-priority'
  | 'remote'
  | 'no-response'
