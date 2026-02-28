import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { io, Socket } from 'socket.io-client';

@Component({
    selector: 'app-scraper-page',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './scraper.component.html',
    styleUrl: './scraper.component.scss',
})
export class ScraperPageComponent implements OnInit, OnDestroy, AfterViewChecked {
    private http = inject(HttpClient);
    private cdr = inject(ChangeDetectorRef);
    private socket!: Socket;

    @ViewChild('terminalBody') terminalBody!: ElementRef;

    isRunning = false;
    logs: { timestamp: string, message: string }[] = [];
    selectedVendor = 'ecarstrade';

    private shouldScroll = false;

    ngOnInit() {
        this.checkStatus();

        // Connect to /scraper namespace
        const wsUrl = environment.apiUrl.replace('/api', '') + '/scraper';
        this.socket = io(wsUrl, { transports: ['websocket'] });

        this.socket.on('scraper-log', (data) => {
            this.logs.push(data);
            this.shouldScroll = true;
            this.cdr.detectChanges();
        });
    }

    ngAfterViewChecked() {
        if (this.shouldScroll) {
            this.scrollToBottom();
            this.shouldScroll = false;
        }
    }

    ngOnDestroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    checkStatus() {
        this.http.get<{ isRunning: boolean }>(`${environment.apiUrl}/scraper/status`).subscribe(res => {
            this.isRunning = res.isRunning;
            this.cdr.detectChanges();
        });
    }

    startScraper() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logs = [{ timestamp: new Date().toISOString(), message: `Starting ${this.selectedVendor} scraper task...` }];

        this.http.post(`${environment.apiUrl}/scraper/run`, {
            vendor: this.selectedVendor,
            maxPages: 1
        }).subscribe({
            next: (res: any) => {
                this.logs.push({ timestamp: new Date().toISOString(), message: `Scraper process initialized successfully.` });
                this.checkStatus();
            },
            error: (err) => {
                this.isRunning = false;
                this.logs.push({ timestamp: new Date().toISOString(), message: `Error starting scraper: ${err.message}` });
                this.cdr.detectChanges();
            }
        });
    }

    clearLogs() {
        this.logs = [];
    }

    private scrollToBottom() {
        if (this.terminalBody) {
            this.terminalBody.nativeElement.scrollTop = this.terminalBody.nativeElement.scrollHeight;
        }
    }
}
