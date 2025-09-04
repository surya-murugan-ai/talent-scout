import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  FileText, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Code, 
  Award, 
  ExternalLink,
  Calendar,
  Clock,
  Trash2
} from 'lucide-react';

interface ResumeData {
  resumeData: {
    id: string;
    filename: string;
    name: string;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    location: string | null;
    title: string | null;
    summary: string | null;
    experience: any[];
    education: any[];
    projects: any[];
    achievements: any[];
    certifications: any[];
    skills: string[];
    interests: string[];
    languages: string[];
    rawText: string | null;
    confidence: number;
    processingTime: number;
    source: string;
    createdAt: string;
    updatedAt: string;
  };
  candidate: {
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    company: string | null;
    linkedinUrl: string | null;
    githubUrl: string | null;
    portfolioUrl: string | null;
    location: string | null;
    skills: string[];
    score: number;
    priority: string;
    openToWork: boolean;
    lastActive: string | null;
    notes: string | null;
    source: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export default function ResumeDataPage() {
  const [selectedResume, setSelectedResume] = useState<ResumeData | null>(null);

  const { data: resumeData, isLoading, error, refetch } = useQuery({
    queryKey: ['resume-data'],
    queryFn: async () => {
      const response = await fetch('/api/resume-data');
      if (!response.ok) {
        throw new Error('Failed to fetch resume data');
      }
      return response.json() as ResumeData[];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resume data?')) {
      return;
    }

    try {
      const response = await fetch(`/api/resume-data/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete resume data');
      }

      // Refetch the data
      refetch();
    } catch (error) {
      console.error('Error deleting resume data:', error);
      alert('Failed to delete resume data');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading resume data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-red-600">Error loading resume data: {error.message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Resume Data</h1>
        <p className="text-gray-600">
          View all extracted resume data from uploaded PDF and DOCX files
        </p>
      </div>

      <div className="grid gap-6">
        {resumeData?.map((item) => (
          <Card key={item.resumeData.id} className="hover:shadow-lg transition-shadow bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                  <div>
                    <CardTitle className="text-xl">{item.resumeData.name}</CardTitle>
                    <p className="text-sm text-gray-500">{item.resumeData.filename}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={item.resumeData.confidence >= 80 ? "default" : "secondary"}>
                    {item.resumeData.confidence}% Confidence
                  </Badge>
                  <Badge variant="outline">
                    {item.resumeData.processingTime}ms
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedResume(item)}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(item.resumeData.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Basic Info */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Basic Info</span>
                  </div>
                  <div className="text-sm space-y-1">
                    {item.resumeData.title && (
                      <p><Briefcase className="h-3 w-3 inline mr-1" />{item.resumeData.title}</p>
                    )}
                    {item.resumeData.location && (
                      <p><MapPin className="h-3 w-3 inline mr-1" />{item.resumeData.location}</p>
                    )}
                    {item.resumeData.email && (
                      <p><Mail className="h-3 w-3 inline mr-1" />{item.resumeData.email}</p>
                    )}
                    {item.resumeData.phone && (
                      <p><Phone className="h-3 w-3 inline mr-1" />{item.resumeData.phone}</p>
                    )}
                  </div>
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <ExternalLink className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Links</span>
                  </div>
                  <div className="text-sm space-y-1">
                    {item.resumeData.linkedinUrl && (
                      <a 
                        href={item.resumeData.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />LinkedIn
                      </a>
                    )}
                    {item.resumeData.githubUrl && (
                      <a 
                        href={item.resumeData.githubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gray-600 hover:underline flex items-center"
                      >
                        <Code className="h-3 w-3 mr-1" />GitHub
                      </a>
                    )}
                    {item.resumeData.portfolioUrl && (
                      <a 
                        href={item.resumeData.portfolioUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline flex items-center"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />Portfolio
                      </a>
                    )}
                  </div>
                </div>

                {/* Experience & Education */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <GraduationCap className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Experience & Education</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><Briefcase className="h-3 w-3 inline mr-1" />{item.resumeData.experience?.length || 0} positions</p>
                    <p><GraduationCap className="h-3 w-3 inline mr-1" />{item.resumeData.education?.length || 0} degrees</p>
                    <p><Code className="h-3 w-3 inline mr-1" />{item.resumeData.projects?.length || 0} projects</p>
                  </div>
                </div>

                {/* Skills */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Code className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.resumeData.skills?.slice(0, 5).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {item.resumeData.skills?.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.resumeData.skills.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed View Modal */}
      <Dialog open={!!selectedResume} onOpenChange={() => setSelectedResume(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader className="bg-white border-b border-gray-200 pb-4">
            <DialogTitle className="flex items-center space-x-2 text-gray-900">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Resume Details - {selectedResume?.resumeData.name}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedResume && (
            <div className="px-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-6 bg-gray-100 border border-gray-200 mb-6">
                  <TabsTrigger value="basic" className="py-2 px-3">Basic</TabsTrigger>
                  <TabsTrigger value="experience" className="py-2 px-3">Experience</TabsTrigger>
                  <TabsTrigger value="education" className="py-2 px-3">Education</TabsTrigger>
                  <TabsTrigger value="projects" className="py-2 px-3">Projects</TabsTrigger>
                  <TabsTrigger value="skills" className="py-2 px-3">Skills</TabsTrigger>
                  <TabsTrigger value="raw" className="py-2 px-3">Raw Text</TabsTrigger>
                </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Name</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Title</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.title || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Email</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.email || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Phone</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Location</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.location || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Confidence</label>
                        <p className="text-sm text-gray-600">{selectedResume.resumeData.confidence}%</p>
                      </div>
                    </div>

                    {selectedResume.resumeData.summary && (
                      <div className="mt-4">
                        <label className="text-sm font-medium">Summary</label>
                        <p className="text-sm text-gray-600 mt-1">{selectedResume.resumeData.summary}</p>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      <label className="text-sm font-medium">Links</label>
                      <div className="space-y-1">
                        {selectedResume.resumeData.linkedinUrl && (
                          <a 
                            href={selectedResume.resumeData.linkedinUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />LinkedIn
                          </a>
                        )}
                        {selectedResume.resumeData.githubUrl && (
                          <a 
                            href={selectedResume.resumeData.githubUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-600 hover:underline flex items-center"
                          >
                            <Code className="h-3 w-3 mr-1" />GitHub
                          </a>
                        )}
                        {selectedResume.resumeData.portfolioUrl && (
                          <a 
                            href={selectedResume.resumeData.portfolioUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-600 hover:underline flex items-center"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />Portfolio
                          </a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="experience">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Work Experience</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResume.resumeData.experience?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedResume.resumeData.experience.map((exp, index) => (
                          <div key={index} className="border-l-4 border-blue-500 pl-4">
                            <h4 className="font-semibold">{exp.jobTitle}</h4>
                            <p className="text-sm text-gray-600">{exp.company}</p>
                            <p className="text-sm text-gray-500">{exp.duration}</p>
                            {exp.description && (
                              <p className="text-sm mt-2">{exp.description}</p>
                            )}
                            {exp.techUsed?.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">Technologies: </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {exp.techUsed.map((tech, techIndex) => (
                                    <Badge key={techIndex} variant="outline" className="text-xs">
                                      {tech}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No experience data found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="education">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Education</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResume.resumeData.education?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedResume.resumeData.education.map((edu, index) => (
                          <div key={index} className="border-l-4 border-green-500 pl-4">
                            <h4 className="font-semibold">{edu.degree}</h4>
                            <p className="text-sm text-gray-600">{edu.university}</p>
                            <p className="text-sm text-gray-500">{edu.year}</p>
                            {edu.percentage && (
                              <p className="text-sm text-gray-500">Percentage: {edu.percentage}</p>
                            )}
                            {edu.gpa && (
                              <p className="text-sm text-gray-500">GPA: {edu.gpa}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No education data found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="projects">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Projects</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResume.resumeData.projects?.length > 0 ? (
                      <div className="space-y-4">
                        {selectedResume.resumeData.projects.map((project, index) => (
                          <div key={index} className="border-l-4 border-purple-500 pl-4">
                            <h4 className="font-semibold">{project.name}</h4>
                            {project.description && (
                              <p className="text-sm mt-1">{project.description}</p>
                            )}
                            {project.techUsed?.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium">Technologies: </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {project.techUsed.map((tech, techIndex) => (
                                    <Badge key={techIndex} variant="outline" className="text-xs">
                                      {tech}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500">No projects found</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="skills">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Skills & Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Skills */}
                      <div>
                        <h4 className="font-semibold mb-2">Skills</h4>
                        {selectedResume.resumeData.skills?.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedResume.resumeData.skills.map((skill, index) => (
                              <Badge key={index} variant="default">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No skills found</p>
                        )}
                      </div>

                      {/* Certifications */}
                      <div>
                        <h4 className="font-semibold mb-2">Certifications</h4>
                        {selectedResume.resumeData.certifications?.length > 0 ? (
                          <div className="space-y-2">
                            {selectedResume.resumeData.certifications.map((cert, index) => (
                              <div key={index} className="border-l-4 border-yellow-500 pl-4">
                                <h5 className="font-medium">{cert.name}</h5>
                                <p className="text-sm text-gray-600">{cert.issuer}</p>
                                {cert.date && (
                                  <p className="text-sm text-gray-500">Date: {cert.date}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No certifications found</p>
                        )}
                      </div>

                      {/* Interests */}
                      {selectedResume.resumeData.interests?.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Interests</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedResume.resumeData.interests.map((interest, index) => (
                              <Badge key={index} variant="outline">
                                {interest}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Languages */}
                      {selectedResume.resumeData.languages?.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Languages</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedResume.resumeData.languages.map((language, index) => (
                              <Badge key={index} variant="outline">
                                {language}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="raw">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader>
                    <CardTitle>Raw Extracted Text</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedResume.resumeData.rawText ? (
                      <pre className="text-sm bg-gray-100 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">
                        {selectedResume.resumeData.rawText}
                      </pre>
                    ) : (
                      <p className="text-gray-500">No raw text available</p>
                    )}
                  </CardContent>
                </Card>
                              </TabsContent>
              </Tabs>
            </div>
            )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
