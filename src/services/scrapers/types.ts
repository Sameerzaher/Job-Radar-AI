/**
 * Raw job data as extracted from a careers page (before normalization).
 */
export interface ScrapedJobRaw {
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  description: string;
  postedDate: string | null;
}
