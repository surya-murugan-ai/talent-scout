import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ExternalLink, Mail, Phone, MapPin, Calendar, Award, GraduationCap, Code, Trophy, Heart, Globe, User } from 'lucide-react';

interface Experience {
  jobTitle: string;
  company: string;
  duration: string;
  startDate?: string;
  endDate?: string;
  techUsed: string[];
  description: string;
  achievements?: string[];
}

interface Education {
  degree: string;
  field: string;
  university: string;
  year: string;
  percentage?: string;
  gpa?: string;
  location?: string;
}

interface Project {
  name: string;
  description: string;
  techUsed: string[];
  duration?: string;
  url?: string;
  achievements?: string[];
}

interface Achievement {
  title: string;
  description: string;
  year?: string;
  organization?: string;
}

interface Certification {
  name: string;
  issuer: string;
  date: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
}

interface ComprehensiveCandidateData {
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  location?: string;
  title?: string;
  summary?: string;
  experience: Experience[];
  education: Education[];
  projects: Project[];
  achievements: Achievement[];
  certifications: Certification[];
  skills: string[];
  interests?: string[];
  languages?: string[];
  confidence: number;
  processingTime: number;
}

interface ComprehensiveCandidateDetailsProps {
  candidate: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    location?: string;
    title?: string;
    company?: string;
    currentEmployer?: string;
    skills?: string[];
    originalData?: any;
    confidence?: number;
    processingTime?: number;
    source?: string;
  };
  onEnrichLinkedIn?: (candidateId: string) => void;
  isEnriching?: boolean;
}

export function ComprehensiveCandidateDetails({ 
  candidate, 
  onEnrichLinkedIn, 
  isEnriching = false 
}: ComprehensiveCandidateDetailsProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Utility function to safely render values and prevent object rendering errors
  const safeRender = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      // If it's an object with title and subComponents, extract the title
      if (value.title && typeof value.title === 'string') {
        return value.title;
      }
      // For other objects, try to find a displayable string
      if (value.name && typeof value.name === 'string') return value.name;
      if (value.company && typeof value.company === 'string') return value.company;
      if (value.position && typeof value.position === 'string') return value.position;
      // Fallback to JSON string (truncated)
      return JSON.stringify(value).substring(0, 100) + (JSON.stringify(value).length > 100 ? '...' : '');
    }
    return String(value);
  };

  // Utility function to safely check if a value is an array and has items
  const safeArrayCheck = (value: any): boolean => {
    return value && Array.isArray(value) && value.length > 0;
  };

  // Utility function to safely access array properties
  const safeArrayAccess = (obj: any, property: string): any[] => {
    return obj && obj[property] && Array.isArray(obj[property]) ? obj[property] : [];
  };

  // Extract comprehensive data from originalData, extractedData, or candidate data
  const comprehensiveData: ComprehensiveCandidateData | null = 
    candidate.originalData ? candidate.originalData :
    (candidate as any).extractedData ? (candidate as any).extractedData :
    candidate.source === 'resume' ? candidate as any :
    null;

  // Debug: Log candidate data to identify problematic fields
  console.log('🔍 Candidate data for debugging:', {
    id: candidate.id,
    name: candidate.name,
    title: candidate.title,
    originalData: candidate.originalData,
    extractedData: (candidate as any).extractedData,
    enrichedData: (candidate as any).enrichedData,
    source: candidate.source,
    hasOriginalData: !!candidate.originalData,
    hasExtractedData: !!(candidate as any).extractedData,
    originalDataType: candidate.originalData ? typeof candidate.originalData : 'none',
    extractedDataType: (candidate as any).extractedData ? typeof (candidate as any).extractedData : 'none',
    originalDataKeys: candidate.originalData ? Object.keys(candidate.originalData) : [],
    extractedDataKeys: (candidate as any).extractedData ? Object.keys((candidate as any).extractedData) : []
  });

  if (!comprehensiveData) {
    // Fallback to basic candidate data
    return (
      <Card className="w-full bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {candidate.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Detailed resume data is not available for this candidate. 
              This could be because:
            </p>
            <ul className="text-sm text-yellow-700 mt-2 list-disc list-inside">
              <li>The candidate was imported from CSV/Excel (not resume parsing)</li>
              <li>Resume parsing failed or was incomplete</li>
              <li>Data structure has changed</li>
            </ul>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Contact Information</h4>
              <div className="space-y-2">
                {candidate.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{safeRender(candidate.email)}</span>
                  </div>
                )}
                {candidate.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{safeRender(candidate.phone)}</span>
                  </div>
                )}
                {candidate.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{safeRender(candidate.location)}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Professional Info</h4>
              <div className="space-y-2">
                {candidate.title && <p><strong>Title:</strong> {safeRender(candidate.title)}</p>}
                {candidate.company && <p><strong>Company:</strong> {safeRender(candidate.company)}</p>}
                {candidate.currentEmployer && <p><strong>Current Employer:</strong> {safeRender(candidate.currentEmployer)}</p>}
                {candidate.skills && candidate.skills.length > 0 && (
                  <div>
                    <strong>Skills:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {candidate.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary">{safeRender(skill)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {onEnrichLinkedIn && (
            <div className="mt-4 pt-4 border-t">
              <Button 
                onClick={() => onEnrichLinkedIn(candidate.id)}
                disabled={isEnriching}
                className="w-full"
              >
                {isEnriching ? 'Enriching...' : 'Enrich with LinkedIn Data'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {comprehensiveData.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Confidence: {comprehensiveData.confidence}%
            </Badge>
            {onEnrichLinkedIn && (
              <Button 
                onClick={() => onEnrichLinkedIn(candidate.id)}
                disabled={isEnriching}
                size="sm"
              >
                {isEnriching ? 'Enriching...' : 'Enrich LinkedIn'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="certifications">Certifications</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Contact Information
                </h4>
                <div className="space-y-2">
                  {comprehensiveData.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{comprehensiveData.email}</span>
                    </div>
                  )}
                  {comprehensiveData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{comprehensiveData.phone}</span>
                    </div>
                  )}
                  {comprehensiveData.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{comprehensiveData.location}</span>
                    </div>
                  )}
                  {comprehensiveData.linkedinUrl && (
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={comprehensiveData.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                  {comprehensiveData.githubUrl && (
                    <div className="flex items-center gap-2">
                      <Code className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={comprehensiveData.githubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        GitHub Profile
                      </a>
                    </div>
                  )}
                  {comprehensiveData.portfolioUrl && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={comprehensiveData.portfolioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Portfolio
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Summary */}
              <div>
                <h4 className="font-semibold mb-3">Professional Summary</h4>
                {comprehensiveData.summary ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {comprehensiveData.summary}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No summary available</p>
                )}
              </div>
            </div>

            {/* Skills */}
            {safeArrayCheck(comprehensiveData.skills) && (
              <div>
                <h4 className="font-semibold mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {safeArrayAccess(comprehensiveData, 'skills').map((skill, index) => (
                    <Badge key={index} variant="secondary">{safeRender(skill)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {safeArrayCheck(comprehensiveData.languages) && (
              <div>
                <h4 className="font-semibold mb-3">Languages</h4>
                <div className="flex flex-wrap gap-2">
                  {safeArrayAccess(comprehensiveData, 'languages').map((language, index) => (
                    <Badge key={index} variant="outline">{safeRender(language)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Interests */}
            {safeArrayCheck(comprehensiveData.interests) && (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Interests
                </h4>
                <div className="flex flex-wrap gap-2">
                  {safeArrayAccess(comprehensiveData, 'interests').map((interest, index) => (
                    <Badge key={index} variant="outline">{safeRender(interest)}</Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="experience">
            {comprehensiveData.experience && Array.isArray(comprehensiveData.experience) && comprehensiveData.experience.length > 0 ? (
              <div className="space-y-4">
                {comprehensiveData.experience.map((exp, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">{safeRender(exp.jobTitle)}</h4>
                          <p className="text-sm text-muted-foreground">{safeRender(exp.company)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{safeRender(exp.duration)}</p>
                          {exp.startDate && exp.endDate && (
                            <p className="text-xs text-muted-foreground">
                              {safeRender(exp.startDate)} - {safeRender(exp.endDate)}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mb-3">{safeRender(exp.description)}</p>
                      {exp.techUsed && exp.techUsed.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Technologies Used:</p>
                          <div className="flex flex-wrap gap-1">
                            {exp.techUsed.map((tech, techIndex) => (
                              <Badge key={techIndex} variant="secondary" className="text-xs">
                                {safeRender(tech)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {exp.achievements && exp.achievements.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-1">Key Achievements:</p>
                          <ul className="text-sm space-y-1">
                            {exp.achievements.map((achievement, achIndex) => (
                              <li key={achIndex} className="flex items-start gap-2">
                                <span className="text-muted-foreground">•</span>
                                <span>{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No experience information available</p>
            )}
          </TabsContent>

          <TabsContent value="education">
            {comprehensiveData.education && Array.isArray(comprehensiveData.education) && comprehensiveData.education.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Degree</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Grade/GPA</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprehensiveData.education.map((edu, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{edu.degree}</TableCell>
                      <TableCell>{edu.field}</TableCell>
                      <TableCell>{edu.university}</TableCell>
                      <TableCell>{edu.year}</TableCell>
                      <TableCell>{edu.percentage || edu.gpa || 'N/A'}</TableCell>
                      <TableCell>{edu.location || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">No education information available</p>
            )}
          </TabsContent>

          <TabsContent value="projects">
            {comprehensiveData.projects && Array.isArray(comprehensiveData.projects) && comprehensiveData.projects.length > 0 ? (
              <div className="space-y-4">
                {comprehensiveData.projects.map((project, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold">{project.name}</h4>
                        {project.url && (
                          <a 
                            href={project.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                      {project.techUsed && project.techUsed.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium mb-1">Technologies:</p>
                          <div className="flex flex-wrap gap-1">
                            {project.techUsed.map((tech, techIndex) => (
                              <Badge key={techIndex} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {project.duration && (
                        <p className="text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          {project.duration}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No projects information available</p>
            )}
          </TabsContent>

          <TabsContent value="achievements">
            {comprehensiveData.achievements && Array.isArray(comprehensiveData.achievements) && comprehensiveData.achievements.length > 0 ? (
              <div className="space-y-4">
                {comprehensiveData.achievements.map((achievement, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <Trophy className="h-5 w-5 text-yellow-500 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold">{achievement.title}</h4>
                          <p className="text-sm text-muted-foreground">{achievement.description}</p>
                          {achievement.year && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {achievement.year}
                              {achievement.organization && ` • ${achievement.organization}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No achievements information available</p>
            )}
          </TabsContent>

          <TabsContent value="certifications">
            {comprehensiveData.certifications && Array.isArray(comprehensiveData.certifications) && comprehensiveData.certifications.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certification</TableHead>
                    <TableHead>Issuer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Credential ID</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comprehensiveData.certifications.map((cert, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{cert.name}</TableCell>
                      <TableCell>{cert.issuer}</TableCell>
                      <TableCell>{cert.date}</TableCell>
                      <TableCell>{cert.expiryDate || 'N/A'}</TableCell>
                      <TableCell>{cert.credentialId || 'N/A'}</TableCell>
                      <TableCell>
                        {cert.url && (
                          <a 
                            href={cert.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">No certifications information available</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
