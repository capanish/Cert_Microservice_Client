import { Component, OnInit, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { Subscription, Subject, Observable, interval, Observer, of, throwError } from 'rxjs';
import { takeWhile, map, catchError, finalize, takeUntil, distinctUntilChanged } from 'rxjs/internal/operators';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { WebSocketSubject } from 'rxjs/internal/observable/dom/WebSocketSubject';
import { Budget, ConsultingPeriodsService, Periodo } from '../services/consulting-periods.service';
import * as moment from 'moment';
import * as Stomp from '@stomp/stompjs';
import * as SockJS from 'sockjs-client';
import { HttpClient } from '@angular/common/http';
import { stompConfig } from '../../../core/stomp.config';
import { FrameImpl } from '@stomp/stompjs';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { AppDateAdapter, APP_DATE_FORMATS } from '../../../shared/dateAdapter/date.adapter';
import { NotificationService } from '../../../shared/notification/notification.service';
import { TranslationES } from '../../../shared/translation/translate_es';

@Component({
  selector: 'adif-consultant-period-home',
  templateUrl: './consultant-period-home.component.html',
  styleUrls: ['./consultant-period-home.component.scss'],
  providers: [
    { provide: DateAdapter, useClass: AppDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS }
  ]
})
export class ConsultantPeriodHomeComponent implements OnInit, OnDestroy {
  private stompClient = null;
  connectionStatus = false;
  private unsubscribe = new Subject();
  whileLoading = false;
  periodoControl;
  codigoControl;
  consultingPeriodsManagement: FormGroup;
  codigo$: Observable<Budget[]>;
  status = '';

  constructor(
    private http: HttpClient,
    private formBuilder: FormBuilder,
    private consultingPeriodsService: ConsultingPeriodsService,
    private notificationService: NotificationService
  ) {
    this.connect();
    this.loadBudgetList();
    this.consultingPeriodsManagement = this.formBuilder.group({
      periodo: ['', Validators.required],
      codigo: ['', Validators.required]
    });
    this.periodoControl = this.consultingPeriodsManagement.get('periodo');
    this.codigoControl = this.consultingPeriodsManagement.get('codigo');
    this.periodoControl.valueChanges
    .pipe(
      takeUntil(this.unsubscribe),
      distinctUntilChanged()
    )
    .subscribe(currentDate => {
      this.initialStatus();
    });
  }

  ngOnInit() {
  }

  public hasError = (controlName: string, errorName: string) => {
    return this.consultingPeriodsManagement.controls[controlName].hasError(errorName);
  }

  loadBudgetList() {
    this.codigo$ =  this.consultingPeriodsService.getAllCodigo();
  }

  firstDayOfMonth = (d: Date): boolean => {
    const day = d.getDate();
    return day === 1;
  }

  connect() {
    const socket = new SockJS(stompConfig.brokerURL);
    this.stompClient = Stomp.Stomp.over(socket);
    const self = this;
    this.stompClient.connect({}, function (frame) {
      console.log('Connected: ' + frame);
      self.connectionStatus = true;
      self.stompClient
      .subscribe('/topic/status', function (data: FrameImpl) {
        self.status = JSON.parse(data.body)['status'];
        self.whileLoading = false;
      });
    });
  }

  send(obj: Periodo) {
    this.whileLoading = true;
    this.consultingPeriodsService.cert(obj)
    .pipe(
      catchError(err => {
        this.notificationService.setNotification(TranslationES.consultant_period.serviceUnAvailable);
        this.whileLoading = false;
        return throwError(err);
      })
    )
    .subscribe();
  }

  initialStatus() {

    if (this.periodoControl.valid && this.codigoControl.valid) {

      this.status = 'En curso';

    }

  }

  consultingPeriodsManagementSubmit() {
    if (this.consultingPeriodsManagement.valid) {
      this.send({
        'periodo': moment(this.periodoControl.value).format('DD/MM/YYYY'),
        'codigo': this.codigoControl.value
      });
    }
  }

  @HostListener('body:click', ['$event'])
  onclick(event) {
    const ele: HTMLElement = <HTMLElement> event.target;
    const eleClass = ele.parentElement.parentElement;
    if (eleClass && !eleClass.classList.contains('notificationMsg')) {
      this.notificationService.setNotification(null);
    }
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event) {
    this.notificationService.setNotification(null);
  }

  ngOnDestroy() {
    if (this.stompClient != null) {
      this.stompClient.disconnect();
    }
  }

}
